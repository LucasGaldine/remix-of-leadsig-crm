interface SupabaseLike {
  from: (table: string) => any;
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown }>;
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

  const invoiceNumber = await supabase.rpc("get_next_invoice_number", {
    p_account_id: accountId,
  });

  const dueDate = new Date().toISOString().split("T")[0];

  const { data: newInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      customer_id: customerId,
      lead_id: jobId,
      estimate_id: estimate?.id || null,
      invoice_number: invoiceNumber.data || 1,
      subtotal: amount,
      tax_rate: 0,
      tax: 0,
      discount: 0,
      total: amount,
      balance_due: 0,
      notes: `Payment received via ${methodLabel}`,
      status: "paid",
      due_date: dueDate,
      created_by: userId,
      account_id: accountId,
    })
    .select("id")
    .single();

  if (invoiceError || !newInvoice?.id) {
    throw new Error("Failed to create invoice");
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

export function selectInvoiceForLoggedPayment(
  invoices: LoggedPaymentInvoiceCandidate[],
): LoggedPaymentInvoiceCandidate | null {
  const openInvoice = invoices.find((invoice) => {
    const balanceDue = Number(invoice.balance_due || 0);
    return invoice.status !== "paid" && balanceDue > 0;
  });

  return openInvoice ?? null;
}
