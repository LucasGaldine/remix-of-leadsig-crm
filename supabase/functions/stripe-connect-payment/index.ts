import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get request body
    const { amount, invoiceId, customerId, jobId, customerEmail, customerName, description } = await req.json();
    
    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (!invoiceId) throw new Error("Invoice ID is required");
    if (!customerId) throw new Error("Customer ID is required");
    logStep("Payment request", { amount, invoiceId, customerId });

    // Get user's connected Stripe account
    const { data: accountData } = await supabaseClient
      .from("stripe_connect_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!accountData) {
      throw new Error("Stripe account not connected. Please connect your Stripe account first.");
    }

    if (!accountData.charges_enabled) {
      throw new Error("Stripe account is not fully set up. Please complete your Stripe onboarding.");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create a Checkout Session for the connected account
    const origin = req.headers.get("origin") || "http://localhost:5173";
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: description || `Invoice Payment`,
              description: customerName ? `Payment from ${customerName}` : undefined,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      payment_intent_data: {
        application_fee_amount: 0, // LeadSig doesn't take a fee
        transfer_data: {
          destination: accountData.stripe_account_id,
        },
      },
      success_url: `${origin}/payments?payment_success=true&invoice_id=${invoiceId}`,
      cancel_url: `${origin}/invoices/${invoiceId}?payment_cancelled=true`,
      metadata: {
        invoice_id: invoiceId,
        customer_id: customerId,
        job_id: jobId || "",
        user_id: user.id,
      },
    }, {
      stripeAccount: undefined, // Use platform account but transfer to connected
    });

    logStep("Created Checkout session", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
