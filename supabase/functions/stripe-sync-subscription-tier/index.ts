import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import {
  BASIC_TIER_MONTHLY_PRICE_CENTS,
  PREMIUM_MONTHLY_PRICE_CENTS,
  isBasicTier,
  isPlanKey,
  type BasicTier,
  type PlanKey,
} from "../_shared/billing-plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function inferTierFromSubscription(subscription: Stripe.Subscription): BasicTier | null {
  for (const item of subscription.items.data) {
    const metadataTier = item.price?.metadata?.leadsig_tier ?? "";
    if (isBasicTier(metadataTier)) return metadataTier;
  }

  for (const item of subscription.items.data) {
    const unitAmount = item.price?.unit_amount ?? null;
    if (unitAmount === BASIC_TIER_MONTHLY_PRICE_CENTS.solo) return "solo";
    if (unitAmount === BASIC_TIER_MONTHLY_PRICE_CENTS.team) return "team";
    if (unitAmount === BASIC_TIER_MONTHLY_PRICE_CENTS.growth) return "growth";
  }

  return null;
}

function inferPlanFromSubscription(subscription: Stripe.Subscription): PlanKey | null {
  for (const item of subscription.items.data) {
    const metadataPlan = item.price?.metadata?.leadsig_plan ?? "";
    if (isPlanKey(metadataPlan)) return metadataPlan;
  }

  for (const item of subscription.items.data) {
    const unitAmount = item.price?.unit_amount ?? null;
    if (
      unitAmount === BASIC_TIER_MONTHLY_PRICE_CENTS.solo
      || unitAmount === BASIC_TIER_MONTHLY_PRICE_CENTS.team
      || unitAmount === BASIC_TIER_MONTHLY_PRICE_CENTS.growth
    ) {
      return "basic";
    }
    if (unitAmount === PREMIUM_MONTHLY_PRICE_CENTS) {
      return "premium";
    }
  }

  return null;
}

function getActiveSubscription(subscriptions: Stripe.ApiList<Stripe.Subscription>): Stripe.Subscription | null {
  return subscriptions.data.find((subscription) =>
    ["trialing", "active", "past_due", "unpaid"].includes(subscription.status),
  ) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Billing sync service is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: membership, error: membershipError } = await supabaseUser
      .from("account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error("No active account membership found");
    }

    const accountId = membership.account_id as string;

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id, company_email, company_name, pricing_plan, pricing_tier, stripe_subscription_id")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error(accountError?.message || "Account not found");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });

    let subscription: Stripe.Subscription | null = null;

    if (account.stripe_subscription_id) {
      try {
        const byId = await stripe.subscriptions.retrieve(account.stripe_subscription_id, {
          expand: ["items.data.price"],
        });
        if (["trialing", "active", "past_due", "unpaid"].includes(byId.status)) {
          subscription = byId;
        }
      } catch {
        // Fallback to customer lookup below.
      }
    }

    if (!subscription && account.company_email) {
      const customers = await stripe.customers.list({ email: account.company_email, limit: 25 });
      const matchedCustomer = customers.data.find((customer) => customer.metadata?.account_id === accountId)
        ?? customers.data[0]
        ?? null;

      if (matchedCustomer) {
        const subscriptions = await stripe.subscriptions.list({
          customer: matchedCustomer.id,
          status: "all",
          limit: 25,
          expand: ["data.items.data.price"],
        });
        subscription = getActiveSubscription(subscriptions);
      }
    }

    if (!subscription) {
      return new Response(
        JSON.stringify({
          success: true,
          updated: false,
          reason: "No active Stripe subscription found",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const inferredPlan = inferPlanFromSubscription(subscription);
    const inferredTier = inferTierFromSubscription(subscription);

    const nextPlan: PlanKey = inferredPlan ?? ((account.pricing_plan as PlanKey) || "free");
    const nextTier: BasicTier | null = nextPlan === "basic"
      ? inferredTier ?? (isBasicTier(account.pricing_tier) ? account.pricing_tier : null)
      : null;

    const hasChanges = account.pricing_plan !== nextPlan
      || (account.pricing_tier ?? null) !== nextTier
      || (account.stripe_subscription_id ?? null) !== subscription.id;

    if (!hasChanges) {
      return new Response(
        JSON.stringify({
          success: true,
          updated: false,
          pricing_plan: account.pricing_plan,
          pricing_tier: account.pricing_tier,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("accounts")
      .update({
        pricing_plan: nextPlan,
        pricing_tier: nextTier,
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        pricing_plan: nextPlan,
        pricing_tier: nextTier,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
