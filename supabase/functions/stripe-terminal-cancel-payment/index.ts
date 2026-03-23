import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

import {
  assertTerminalPaymentIntentStatus,
  canCancelTerminalPaymentIntentStatus,
  getTerminalCancelOutcome,
} from "../_shared/terminal-payment-reconciliation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface CancelPaymentRequest {
  paymentIntentId: string;
  invoiceId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new HttpError(400, "Stripe is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new HttpError(401, "Missing authorization");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new HttpError(401, "Unauthorized");
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      throw new HttpError(400, "No active account found");
    }

    const body: CancelPaymentRequest = await req.json();
    const { paymentIntentId, invoiceId } = body;

    if (!paymentIntentId) {
      throw new HttpError(400, "Missing required field: paymentIntentId");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_user_id || !stripeAccount.charges_enabled) {
      throw new HttpError(400, "Stripe account not connected or not enabled for charges");
    }

    let paymentQuery = supabase
      .from("payments")
      .select("id")
      .eq("account_id", membership.account_id)
      .eq("payment_channel", "terminal")
      .eq("stripe_payment_intent_id", paymentIntentId);

    if (invoiceId) {
      paymentQuery = paymentQuery.eq("invoice_id", invoiceId);
    }

    const { data: paymentRecord, error: paymentLookupError } = await paymentQuery.maybeSingle();

    if (paymentLookupError) {
      throw new HttpError(500, "Failed to load terminal payment record");
    }

    if (!paymentRecord) {
      throw new HttpError(404, "No matching terminal payment found");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    let paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { stripeAccount: stripeAccount.stripe_user_id },
    );
    const currentStatus = assertTerminalPaymentIntentStatus(paymentIntent.status);

    if (!canCancelTerminalPaymentIntentStatus(currentStatus)) {
      throw new HttpError(409, `PaymentIntent cannot be canceled from status: ${currentStatus}`);
    }

    if (currentStatus !== "canceled") {
      paymentIntent = await stripe.paymentIntents.cancel(
        paymentIntentId,
        {},
        { stripeAccount: stripeAccount.stripe_user_id },
      );
    }

    const paymentIntentStatus = assertTerminalPaymentIntentStatus(paymentIntent.status);
    const outcome = getTerminalCancelOutcome(paymentIntentStatus);

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: outcome.paymentStatus,
        stripe_terminal_payment_intent_status: paymentIntentStatus,
      })
      .eq("id", paymentRecord.id);

    if (paymentUpdateError) {
      throw new HttpError(500, "Failed to reconcile terminal payment cancellation");
    }

    return new Response(
      JSON.stringify({
        paymentId: paymentRecord.id,
        paymentIntentId: paymentIntent.id,
        paymentIntentStatus,
        paymentStatus: outcome.paymentStatus,
        terminalStatus: outcome.terminalStatus,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error canceling Stripe Terminal payment:", error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      },
    );
  }
});
