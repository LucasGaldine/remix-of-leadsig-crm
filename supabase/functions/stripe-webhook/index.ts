import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response(
        JSON.stringify({ error: "Stripe webhook not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing webhook event:", event.type, event.id);

    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(supabase, paymentIntent);
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, paymentIntent);
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }
      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const stripeInvoiceId = invoice.id;
  console.log("Invoice paid:", stripeInvoiceId);

  const { data: localInvoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, total, customer_id, account_id")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle();

  if (fetchError || !localInvoice) {
    console.log("No matching local invoice for:", stripeInvoiceId);
    return;
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      balance_due: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", localInvoice.id);

  if (updateError) {
    console.error("Failed to update invoice:", updateError.message);
    return;
  }

  const amountPaid = invoice.amount_paid ? invoice.amount_paid / 100 : Number(localInvoice.total);

  if (!invoice.charge) {
    const { data: existingOfflinePayment } = await supabase
      .from("payments")
      .select("id")
      .eq("invoice_id", localInvoice.id)
      .eq("transaction_ref", stripeInvoiceId)
      .maybeSingle();

    if (existingOfflinePayment) {
      console.log("Skipping duplicate offline payment insert for:", stripeInvoiceId);
      return;
    }
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: localInvoice.id,
    customer_id: localInvoice.customer_id,
    account_id: localInvoice.account_id,
    amount: amountPaid,
    method: "card",
    status: "completed",
    transaction_ref: invoice.charge ? String(invoice.charge) : null,
    receipt_url: invoice.hosted_invoice_url || null,
    notes: "Paid via Stripe invoice",
  });

  if (paymentError) {
    console.error("Failed to create payment record:", paymentError.message);
  }

  console.log("Invoice marked as paid:", localInvoice.id);
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const stripeInvoiceId = invoice.id;
  console.log("Invoice payment failed:", stripeInvoiceId);

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "overdue",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_invoice_id", stripeInvoiceId);

  if (error) {
    console.error("Failed to update invoice status:", error.message);
  }
}

async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const piId = paymentIntent.id;
  console.log("PaymentIntent succeeded:", piId);

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("id, invoice_id, amount")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  if (fetchError || !payment) {
    console.log("No matching local payment for:", piId);
    return;
  }

  const receiptUrl =
    paymentIntent.latest_charge &&
    typeof paymentIntent.latest_charge === "object"
      ? (paymentIntent.latest_charge as Stripe.Charge).receipt_url
      : null;

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "completed",
      transaction_ref: paymentIntent.latest_charge
        ? String(
            typeof paymentIntent.latest_charge === "object"
              ? paymentIntent.latest_charge.id
              : paymentIntent.latest_charge
          )
        : null,
      receipt_url: receiptUrl,
    })
    .eq("id", payment.id);

  if (updateError) {
    console.error("Failed to update payment:", updateError.message);
    return;
  }

  if (payment.invoice_id) {
    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        balance_due: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.invoice_id);

    if (invoiceError) {
      console.error("Failed to update invoice:", invoiceError.message);
    }
  }

  console.log("Payment completed:", payment.id);
}

async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const piId = paymentIntent.id;
  console.log("PaymentIntent failed:", piId);

  const { error } = await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error("Failed to update payment status:", error.message);
  }
}

async function handleAccountUpdated(
  supabase: ReturnType<typeof createClient>,
  account: Stripe.Account
) {
  const stripeAccountId = account.id;
  console.log("Account updated:", stripeAccountId);

  const requirements = account.requirements?.currently_due || [];
  let status = "active";
  if (requirements.length > 0) {
    status = "action_required";
  } else if (!account.charges_enabled || !account.payouts_enabled) {
    status = "pending";
  }

  const { error } = await supabase
    .from("stripe_connect_accounts")
    .update({
      account_status: status,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      details_submitted: account.details_submitted || false,
      stripe_account_email: account.email,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_user_id", stripeAccountId);

  if (error) {
    console.error("Failed to update Stripe account:", error.message);
  }
}
