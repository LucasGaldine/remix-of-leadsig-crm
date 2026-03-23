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
