import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentRequest {
  amount: number;
  invoiceId: string;
  customerId: string;
  jobId?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
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
      return new Response(
        JSON.stringify({
          error: "Stripe is not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      throw new Error("No active account found");
    }

    const body: PaymentRequest = await req.json();
    const { amount, invoiceId, customerId, customerEmail, customerName, description } = body;

    if (!amount || !invoiceId || !customerId) {
      throw new Error("Missing required fields: amount, invoiceId, customerId");
    }

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_account_id || !stripeAccount.charges_enabled) {
      throw new Error("Stripe account not connected or not enabled for charges");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        invoice_id: invoiceId,
        customer_id: customerId,
        account_id: membership.account_id,
      },
      description: description || `Payment for invoice ${invoiceId}`,
      receipt_email: customerEmail,
      transfer_data: {
        destination: stripeAccount.stripe_account_id,
      },
    });

    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoiceId,
        customer_id: customerId,
        account_id: membership.account_id,
        amount: amount,
        method: "card",
        status: "pending",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_account_id: stripeAccount.stripe_account_id,
        processed_by: user.id,
      });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating payment session:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
