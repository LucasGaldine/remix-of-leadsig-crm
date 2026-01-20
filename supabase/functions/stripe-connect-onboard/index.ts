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
          error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.",
          setup_required: true,
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
      .select("account_id, accounts(*)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      throw new Error("No active account found");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    let { data: stripeAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("*")
      .eq("account_id", membership.account_id)
      .maybeSingle();

    let stripeAccountId: string;

    if (!stripeAccount || !stripeAccount.stripe_account_id) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "company",
        business_profile: {
          name: (membership.accounts as any)?.company_name || "My Business",
        },
      });

      stripeAccountId = account.id;

      const { data: inserted } = await supabase
        .from("stripe_connect_accounts")
        .insert({
          account_id: membership.account_id,
          stripe_account_id: stripeAccountId,
          account_status: "pending",
        })
        .select()
        .single();

      stripeAccount = inserted;
    } else {
      stripeAccountId = stripeAccount.stripe_account_id;
    }

    const returnUrl = `${req.headers.get("origin") || "https://your-domain.com"}/settings/payments?stripe_connected=true`;
    const refreshUrl = `${req.headers.get("origin") || "https://your-domain.com"}/settings/payments?stripe_refresh=true`;

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating onboarding link:", error);
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
