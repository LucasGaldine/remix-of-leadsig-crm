import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

type PlanKey = "free" | "basic" | "premium";
type BasicTier = "solo" | "team" | "growth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASIC_TIER_MEMBER_CAP: Record<BasicTier, number | null> = {
  solo: 1,
  team: 5,
  growth: null,
};

function resolveMonthlyAmount(targetPlan: PlanKey, targetTier: BasicTier | null): number {
  if (targetPlan === "free") return 0;
  if (targetPlan === "premium") return 49700;
  if (targetPlan === "basic" && targetTier === "solo") return 2900;
  if (targetPlan === "basic" && targetTier === "team") return 11900;
  if (targetPlan === "basic" && targetTier === "growth") return 19700;
  throw new Error("Invalid plan/tier selection");
}

async function getOrCreateRecurringPriceId(
  stripe: Stripe,
  targetPlan: PlanKey,
  targetTier: BasicTier | null
): Promise<string> {
  const monthlyAmount = resolveMonthlyAmount(targetPlan, targetTier);
  if (monthlyAmount <= 0) {
    throw new Error("No recurring price for free plan");
  }

  const existingPrices = await stripe.prices.list({
    active: true,
    currency: "usd",
    type: "recurring",
    limit: 100,
  });
  const matchedPrice = existingPrices.data.find((price) => {
    const plan = price.metadata?.leadsig_plan ?? null;
    const tier = price.metadata?.leadsig_tier ?? null;
    return plan === targetPlan && tier === targetTier;
  });

  if (matchedPrice) {
    return matchedPrice.id;
  }

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: monthlyAmount,
    recurring: { interval: "month" },
    product_data: {
      name:
        targetPlan === "premium"
          ? "LeadSig Premium Monthly"
          : `LeadSig Basic ${targetTier?.toUpperCase()} Monthly`,
    },
    metadata: targetTier
      ? {
          leadsig_plan: targetPlan,
          leadsig_tier: targetTier,
        }
      : {
          leadsig_plan: targetPlan,
        },
  });

  return price.id;
}

async function getOrCreateStripeCustomerId(
  stripe: Stripe,
  accountId: string,
  email: string | null,
  name: string | null
): Promise<string> {
  if (email) {
    const existingCustomers = await stripe.customers.list({ email, limit: 25 });
    const matched = existingCustomers.data.find((customer) => customer.metadata?.account_id === accountId);
    if (matched) {
      return matched.id;
    }
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: {
      account_id: accountId,
    },
  });

  return customer.id;
}

async function getActiveSubscriptionForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 25,
  });

  return subscriptions.data.find((subscription) =>
    ["trialing", "active", "past_due", "unpaid"].includes(subscription.status)
  ) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Billing service is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const body = await req.json();
    const accountId: string | undefined = body?.accountId;
    const targetPlan: PlanKey | undefined = body?.targetPlan;
    const targetTier: BasicTier | null = body?.targetTier ?? null;
    const requestedTrialDays = Number(body?.trialDays ?? 0);
    const trialDays =
      targetPlan === "basic" && Number.isFinite(requestedTrialDays) && requestedTrialDays > 0
        ? Math.min(14, Math.floor(requestedTrialDays))
        : 0;
    const returnUrl: string = body?.returnUrl || `${new URL(req.url).origin}/settings/pricing`;

    if (!accountId || !targetPlan) {
      throw new Error("accountId and targetPlan are required");
    }

    if (targetPlan === "basic" && !targetTier) {
      throw new Error("targetTier is required when selecting the Basic plan");
    }

    if (targetPlan !== "basic" && targetTier) {
      throw new Error("targetTier is only valid for the Basic plan");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error("No active account membership found");
    }

    if (membership.role !== "owner") {
      throw new Error("Only account owners can change billing plans");
    }

    if (targetPlan === "basic" && targetTier) {
      const { count, error: memberCountError } = await supabase
        .from("account_members")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("is_active", true);

      if (memberCountError) {
        throw new Error("Unable to validate team size");
      }

      const activeMembers = count ?? 0;
      const memberCap = BASIC_TIER_MEMBER_CAP[targetTier];

      if (memberCap !== null && activeMembers > memberCap) {
        throw new Error(
          `This account has ${activeMembers} active members and cannot use the ${targetTier} tier (${memberCap} max)`
        );
      }
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, company_name, company_email, pricing_plan")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error(accountError?.message || "Account not found");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const targetPriceId =
      targetPlan === "free"
        ? null
        : await getOrCreateRecurringPriceId(stripe, targetPlan, targetTier);
    const stripeCustomerId = await getOrCreateStripeCustomerId(
      stripe,
      accountId,
      account.company_email,
      account.company_name
    );
    const existingSubscription = await getActiveSubscriptionForCustomer(stripe, stripeCustomerId);

    if (targetPlan === "free") {
      if (existingSubscription) {
        await stripe.subscriptions.cancel(existingSubscription.id);
      }

      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          pricing_plan: "free",
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      if (updateError) {
        throw new Error("Failed to persist free plan state");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Plan moved to Free. Stripe subscription canceled.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!existingSubscription) {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price: targetPriceId!,
          quantity: 1,
        },
      ];

      if (targetPlan === "premium") {
        lineItems.push({
          price_data: {
            currency: "usd",
            unit_amount: 300000,
            product_data: {
              name: "LeadSig Premium Setup Fee",
            },
          },
          quantity: 1,
        });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: lineItems,
        success_url: `${returnUrl}?billing=success`,
        cancel_url: `${returnUrl}?billing=canceled`,
        metadata: {
          account_id: accountId,
          target_plan: targetPlan,
          target_tier: targetTier ?? "",
          premium_setup_applied: targetPlan === "premium" ? "true" : "false",
        },
        subscription_data: {
          ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
          metadata: {
            account_id: accountId,
            target_plan: targetPlan,
            target_tier: targetTier ?? "",
          },
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          checkoutUrl: checkoutSession.url,
          message: "Redirecting to Stripe checkout.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const firstItem = existingSubscription.items.data[0];
    if (!firstItem) {
      throw new Error("Stripe subscription has no items to update");
    }

    await stripe.subscriptions.update(existingSubscription.id, {
      items: [
        {
          id: firstItem.id,
          price: targetPriceId!,
        },
      ],
      proration_behavior: "create_prorations",
      metadata: {
        account_id: accountId,
        target_plan: targetPlan,
        target_tier: targetTier ?? "",
      },
    });

    if (targetPlan === "premium") {
      const premiumSetupAmountCents = 3000 * 100;
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: premiumSetupAmountCents,
        currency: "usd",
        description: "LeadSig Premium setup fee",
      });

      await stripe.invoices.create({
        customer: stripeCustomerId,
        auto_advance: true,
        metadata: {
          account_id: accountId,
          billing_event: "premium_setup_fee",
        },
      });
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        pricing_plan: targetPlan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (updateError) {
      throw new Error("Failed to persist account billing changes");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: targetPlan === "premium"
          ? "Premium plan applied. Stripe billing has been updated."
          : "Plan updated through Stripe billing.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("stripe-manage-subscription error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected billing error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
