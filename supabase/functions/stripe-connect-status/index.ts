import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
          connected: false,
          status: "not_connected",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          error: "Stripe not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
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

    const { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    if (!stripeAccount || !stripeAccount.stripe_account_id) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: "not_connected",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

    const requirements = account.requirements?.currently_due || [];
    let status = "active";
    if (requirements.length > 0) {
      status = "action_required";
    } else if (!account.charges_enabled || !account.payouts_enabled) {
      status = "pending";
    }

    await supabase
      .from("stripe_connect_accounts")
      .update({
        account_status: status,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted || false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stripeAccount.id);

    return new Response(
      JSON.stringify({
        connected: true,
        status,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: requirements,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error checking Stripe status:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        connected: false,
        status: "not_connected",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
