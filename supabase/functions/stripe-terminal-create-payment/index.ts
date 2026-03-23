import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

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

interface TerminalPaymentRequest {
  amount: number;
  invoiceId: string;
  customerId: string;
  jobId?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  channel?: string;
  paymentMethod?: string;
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

    const body: TerminalPaymentRequest = await req.json();
    const { amount, invoiceId, customerId, jobId, customerEmail, description, channel, paymentMethod } = body;

    if (!amount || !invoiceId || !customerId) {
      throw new HttpError(400, "Missing required fields: amount, invoiceId, customerId");
    }

    if (channel && channel !== "terminal") {
      throw new HttpError(400, "Tap to Pay payments must use the terminal channel");
    }

    if (paymentMethod && paymentMethod !== "tap-to-pay") {
      throw new HttpError(400, "Tap to Pay payments must use the tap-to-pay payment method");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_user_id || !stripeAccount.charges_enabled) {
      throw new HttpError(400, "Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        metadata: {
          invoice_id: invoiceId,
          customer_id: customerId,
          account_id: membership.account_id,
          ...(jobId ? { job_id: jobId } : {}),
        },
        description: description || `Tap to Pay payment for invoice ${invoiceId}`,
        receipt_email: customerEmail,
      },
      { stripeAccount: stripeAccount.stripe_user_id },
    );

    const { data: paymentRecord, error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoiceId,
        customer_id: customerId,
        job_id: jobId,
        account_id: membership.account_id,
        amount,
        method: "tap-to-pay",
        status: "pending",
        payment_channel: "terminal",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_account_id: stripeAccount.stripe_user_id,
        stripe_terminal_payment_intent_status: paymentIntent.status,
        processed_by: user.id,
      })
      .select("id")
      .single();

    if (paymentError) {
      throw new HttpError(500, "Failed to create pending payment record");
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: paymentRecord?.id ?? null,
        channel: "terminal",
        paymentMethod: "tap-to-pay",
        status: "terminal_pending",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error creating Stripe Terminal payment session:", error);
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
