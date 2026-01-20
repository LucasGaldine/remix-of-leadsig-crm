import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const stripeClientId = Deno.env.get("STRIPE_CLIENT_ID");
    const stripeClientSecret = Deno.env.get("STRIPE_CLIENT_SECRET");

    if (!stripeClientId || !stripeClientSecret) {
      return new Response(
        JSON.stringify({
          error: "Stripe OAuth is not configured",
          setup_required: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const { code, state } = await req.json();

    if (!code || !state) {
      throw new Error("Missing code or state parameter");
    }

    const stateData = JSON.parse(atob(state));
    const { account_id, user_id, timestamp } = stateData;

    if (Date.now() - timestamp > 600000) {
      throw new Error("State expired");
    }

    const tokenResponse = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_secret: stripeClientSecret,
        code: code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || "Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("id")
      .eq("account_id", account_id)
      .maybeSingle();

    const accountData = {
      account_id: account_id,
      user_id: user_id,
      stripe_user_id: tokenData.stripe_user_id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: null,
      scope: tokenData.scope,
      stripe_publishable_key: tokenData.stripe_publishable_key,
      account_status: "active",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      updated_at: new Date().toISOString(),
    };

    if (existingAccount) {
      await supabase
        .from("stripe_connect_accounts")
        .update(accountData)
        .eq("id", existingAccount.id);
    } else {
      await supabase
        .from("stripe_connect_accounts")
        .insert({
          ...accountData,
          created_at: new Date().toISOString(),
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_user_id: tokenData.stripe_user_id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in OAuth callback:", error);
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
