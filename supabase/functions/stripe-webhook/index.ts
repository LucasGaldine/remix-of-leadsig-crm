import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Helper to log webhook events
async function logWebhookEvent(
  eventId: string,
  eventType: string,
  payload: unknown,
  status: string,
  errorMessage?: string,
  invoiceId?: string,
  paymentId?: string
) {
  try {
    const { error } = await supabaseAdmin.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      payload: payload,
      status,
      error_message: errorMessage,
      invoice_id: invoiceId,
      payment_id: paymentId,
    });
    if (error) {
      console.error("Failed to log webhook event:", error);
    }
  } catch (err) {
    console.error("Exception logging webhook event:", err);
  }
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  let event: Stripe.Event;
  let body: string;

  try {
    body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", errorMessage);
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  console.log(`Received Stripe event: ${event.type} (${event.id})`);

  let status = "processed";
  let errorMessage: string | undefined;
  let invoiceId: string | undefined;
  let paymentId: string | undefined;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);
        
        invoiceId = session.metadata?.invoice_id;
        paymentId = session.metadata?.payment_id;
        
        if (invoiceId) {
          if (paymentId) {
            const { error: paymentError } = await supabaseAdmin
              .from("payments")
              .update({
                status: "completed",
                stripe_payment_intent_id: session.payment_intent as string,
                receipt_url: session.receipt_url || null,
              })
              .eq("id", paymentId);

            if (paymentError) {
              console.error("Error updating payment:", paymentError);
              errorMessage = `Payment update failed: ${paymentError.message}`;
            } else {
              console.log("Payment updated successfully:", paymentId);
            }
          }

          const { data: invoice, error: fetchError } = await supabaseAdmin
            .from("invoices")
            .select("total, balance_due")
            .eq("id", invoiceId)
            .single();

          if (fetchError) {
            console.error("Error fetching invoice:", fetchError);
            errorMessage = `Invoice fetch failed: ${fetchError.message}`;
          } else if (invoice) {
            const amountPaid = (session.amount_total || 0) / 100;
            const newBalance = Math.max(0, invoice.balance_due - amountPaid);
            const newStatus = newBalance <= 0 ? "paid" : "partial";

            const { error: invoiceError } = await supabaseAdmin
              .from("invoices")
              .update({
                balance_due: newBalance,
                status: newStatus,
                paid_at: newBalance <= 0 ? new Date().toISOString() : null,
              })
              .eq("id", invoiceId);

            if (invoiceError) {
              console.error("Error updating invoice:", invoiceError);
              errorMessage = `Invoice update failed: ${invoiceError.message}`;
            } else {
              console.log(`Invoice ${invoiceId} updated: balance=${newBalance}, status=${newStatus}`);
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment intent succeeded:", paymentIntent.id);
        
        const { data: payments, error } = await supabaseAdmin
          .from("payments")
          .update({ status: "completed" })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .eq("status", "pending")
          .select("id, invoice_id");

        if (error) {
          console.error("Error updating payment from payment_intent:", error);
          errorMessage = `Payment update failed: ${error.message}`;
        } else if (payments && payments.length > 0) {
          paymentId = payments[0].id;
          invoiceId = payments[0].invoice_id;
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment intent failed:", paymentIntent.id);
        
        const { data: payments, error } = await supabaseAdmin
          .from("payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .select("id, invoice_id");

        if (error) {
          console.error("Error updating failed payment:", error);
          errorMessage = `Payment update failed: ${error.message}`;
        } else if (payments && payments.length > 0) {
          paymentId = payments[0].id;
          invoiceId = payments[0].invoice_id;
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log("Charge refunded:", charge.id);
        
        if (charge.payment_intent) {
          const { data: payments, error } = await supabaseAdmin
            .from("payments")
            .update({ status: "refunded" })
            .eq("stripe_payment_intent_id", charge.payment_intent as string)
            .select("id, invoice_id");

          if (error) {
            console.error("Error updating refunded payment:", error);
            errorMessage = `Payment update failed: ${error.message}`;
          } else if (payments && payments.length > 0) {
            paymentId = payments[0].id;
            invoiceId = payments[0].invoice_id;
          }
        }
        break;
      }

      default:
        status = "unhandled";
        console.log(`Unhandled event type: ${event.type}`);
    }

    if (errorMessage) {
      status = "error";
    }
  } catch (err: unknown) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "Unknown processing error";
    console.error("Error processing webhook:", errorMessage);
  }

  // Log the event to the database
  await logWebhookEvent(
    event.id,
    event.type,
    event.data.object,
    status,
    errorMessage,
    invoiceId,
    paymentId
  );

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
