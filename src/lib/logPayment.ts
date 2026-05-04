interface SupabaseLike {
  from: (table: string) => any;
  functions?: {
    invoke: (
      fn: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data?: Record<string, any> | null; error?: { message?: string } | null }>;
  };
}

async function getNextInvoiceNumber(
  supabase: SupabaseLike,
  accountId: string,
): Promise<number> {
  if (!supabase.functions?.invoke) {
    throw new Error("Invoice numbering endpoint is not available");
  }

  const { data, error } = await supabase.functions.invoke("secure-invoice-number", {
    body: { account_id: accountId },
  });

  if (error) {
    throw new Error(error.message || "Failed to get next invoice number");
  }

  const invoiceNumber = Number(data?.invoice_number ?? 1);
  if (!Number.isFinite(invoiceNumber) || invoiceNumber < 1) return 1;
  return Math.floor(invoiceNumber);
}

interface EnsureInvoiceForLoggedPaymentInput {
  supabase: SupabaseLike;
  existingInvoiceId?: string | null;
  customerId: string;
  jobId: string;
  accountId: string;
  userId: string;
  amount: number;
  methodLabel: string;
}

interface ReconcileInvoiceForLoggedPaymentInput {
  supabase: SupabaseLike;
  invoiceId: string;
  balanceDue: number;
  paymentAmount: number;
}

interface LoggedPaymentInvoiceCandidate {
  id: string;
  status: string | null;
  balance_due: number | null;
  created_at?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  account_id?: string | null;
  stripe_invoice_id?: string | null;
}

interface RecordLoggedPaymentAgainstInvoiceInput {
  supabase: SupabaseLike;
  invoice: Pick<
    LoggedPaymentInvoiceCandidate,
    "id" | "balance_due" | "customer_id" | "lead_id" | "account_id" | "stripe_invoice_id"
  >;
  paymentAmount: number;
  method: string;
  methodLabel: string;
  userId: string;
}

const CLOSED_INVOICE_STATUSES = new Set(["paid", "completed"]);

function roundCurrencyAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function syncLoggedPaymentToStripeInvoice(
  supabase: SupabaseLike,
  invoiceId: string,
  amount: number,
  method: string,
) {
  if (!supabase.functions?.invoke) {
    throw new Error("Stripe invoice sync is not available");
  }

  const { data, error } = await supabase.functions.invoke("stripe-record-offline-invoice-payment", {
    body: {
      invoiceId,
      amount,
      method,
    },
  });

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Failed to sync payment to Stripe");
  }
}

export async function ensureInvoiceForLoggedPayment(
  input: EnsureInvoiceForLoggedPaymentInput,
): Promise<string> {
  const {
    supabase,
    existingInvoiceId,
    customerId,
    jobId,
    accountId,
    userId,
    amount,
    methodLabel,
  } = input;

  if (existingInvoiceId) {
    return existingInvoiceId;
  }

  const { data: estimate } = await supabase
    .from("estimates")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();

  const invoiceNumber = await getNextInvoiceNumber(supabase, accountId);

  const dueDate = new Date().toISOString().split("T")[0];
  const paidAt = new Date().toISOString();

  const { data: newInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      customer_id: customerId,
      lead_id: jobId,
      estimate_id: estimate?.id || null,
      invoice_number: invoiceNumber,
      subtotal: amount,
      tax_rate: 0,
      tax: 0,
      discount: 0,
      total: amount,
      balance_due: 0,
      notes: `Payment received via ${methodLabel}`,
      status: "paid",
      paid_at: paidAt,
      due_date: dueDate,
      created_by: userId,
      account_id: accountId,
    })
    .select("id")
    .single();

  if (invoiceError || !newInvoice?.id) {
    throw new Error(invoiceError?.message || "Failed to create invoice");
  }

  const { error: lineItemError } = await supabase.from("invoice_line_items").insert({
    invoice_id: newInvoice.id,
    name: `Payment - ${methodLabel}`,
    description: `Payment received via ${methodLabel}`,
    quantity: 1,
    unit: "item",
    unit_price: amount,
    total: amount,
    sort_order: 0,
    account_id: accountId,
  });

  if (lineItemError) {
    throw new Error("Failed to create invoice line item");
  }

  return newInvoice.id;
}

export async function reconcileInvoiceForLoggedPayment(
  input: ReconcileInvoiceForLoggedPaymentInput,
): Promise<void> {
  const { supabase, invoiceId, balanceDue, paymentAmount } = input;
  const newBalance = Math.max(0, balanceDue - paymentAmount);
  const isPaid = newBalance <= 0;

  const updatePayload = {
    balance_due: newBalance,
    status: isPaid ? "paid" : "partial",
    ...(isPaid ? { paid_at: new Date().toISOString() } : {}),
  };

  const { error } = await supabase
    .from("invoices")
    .update(updatePayload)
    .eq("id", invoiceId);

  if (error) {
    throw new Error("Failed to update invoice after recording payment");
  }
}

export async function recordLoggedPaymentAgainstInvoice(
  input: RecordLoggedPaymentAgainstInvoiceInput,
): Promise<void> {
  const {
    supabase,
    invoice,
    paymentAmount,
    method,
    methodLabel,
    userId,
  } = input;

  const normalizedAmount = roundCurrencyAmount(paymentAmount);
  const normalizedBalanceDue = roundCurrencyAmount(Number(invoice.balance_due || 0));

  if (invoice.stripe_invoice_id) {
    if (normalizedAmount !== normalizedBalanceDue) {
      throw new Error("Stripe invoice offline payments must match the remaining balance");
    }

    await syncLoggedPaymentToStripeInvoice(supabase, invoice.id, normalizedAmount, method);
    return;
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    lead_id: invoice.lead_id,
    amount: normalizedAmount,
    method,
    status: "completed",
    processed_by: userId,
    account_id: invoice.account_id,
    transaction_ref: invoice.stripe_invoice_id || null,
    notes: invoice.stripe_invoice_id
      ? `Payment received via ${methodLabel} and synced to Stripe`
      : null,
  });

  if (paymentError) {
    throw new Error("Failed to record payment");
  }

  await reconcileInvoiceForLoggedPayment({
    supabase,
    invoiceId: invoice.id,
    balanceDue: normalizedBalanceDue,
    paymentAmount: normalizedAmount,
  });
}

export function selectInvoiceForLoggedPayment(
  invoices: LoggedPaymentInvoiceCandidate[],
): LoggedPaymentInvoiceCandidate | null {
  const openInvoice = invoices.find((invoice) => {
    const balanceDue = Number(invoice.balance_due || 0);
    return !CLOSED_INVOICE_STATUSES.has(invoice.status ?? "") && balanceDue > 0;
  });

  return openInvoice ?? null;
}
