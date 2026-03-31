import { supabase } from "@/integrations/supabase/client";

interface InvoicePaymentForStripeResync {
  id: string;
  amount: number;
  method: string;
  status: string;
}

export async function resyncInvoicePaymentsWithStripe(invoiceId: string) {
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, amount, method, status")
    .eq("invoice_id", invoiceId);

  if (paymentsError) {
    throw new Error("Failed to load invoice payments");
  }

  const offlinePayments = (payments || []).filter((payment: InvoicePaymentForStripeResync) =>
    payment.status === "completed" &&
    ["cash", "check", "ach"].includes(payment.method),
  );

  const { data, error } = await supabase.functions.invoke("stripe-resync-invoice-payments", {
    body: {
      invoiceId,
      payments: offlinePayments,
    },
  });

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "Failed to resync with Stripe");
  }

  return data;
}
