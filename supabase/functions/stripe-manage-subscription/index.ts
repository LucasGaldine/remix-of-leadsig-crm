import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import {
  PREMIUM_SETUP_FEE_CENTS,
  getMonthlyAmountCents,
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

function getConfiguredRecurringPriceId(targetPlan: PlanKey, targetTier: BasicTier | null): string | null {
  if (targetPlan === "free") return null;
  if (targetPlan === "premium") return Deno.env.get("STRIPE_PRICE_PREMIUM_MONTHLY") ?? null;
  if (targetTier === "solo") return Deno.env.get("STRIPE_PRICE_BASIC_SOLO_MONTHLY") ?? null;
  if (targetTier === "team") return Deno.env.get("STRIPE_PRICE_BASIC_TEAM_MONTHLY") ?? null;
  if (targetTier === "growth") return Deno.env.get("STRIPE_PRICE_BASIC_GROWTH_MONTHLY") ?? null;
  return null;
}

function shouldRequireConfiguredPriceIds(): boolean {
  const value = (Deno.env.get("STRIPE_REQUIRE_CONFIGURED_PRICE_IDS") ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function getConfiguredTestCouponId(): string | null {
  const configured = (Deno.env.get("STRIPE_TEST_COUPON_ID") ?? "").trim();
  if (configured) return configured;
  return null;
}

async function getOrCreateRecurringPriceId(
  stripe: Stripe,
  targetPlan: PlanKey,
  targetTier: BasicTier | null
): Promise<string> {
  const monthlyAmount = getMonthlyAmountCents(targetPlan, targetTier);
  if (monthlyAmount <= 0) {
    throw new Error("No recurring price for free plan");
  }

  const configuredPriceId = getConfiguredRecurringPriceId(targetPlan, targetTier);
  if (configuredPriceId) {
    const configuredPrice = await stripe.prices.retrieve(configuredPriceId);
    const isValidConfiguredPrice =
      configuredPrice.active
      && configuredPrice.currency === "usd"
      && configuredPrice.type === "recurring"
      && configuredPrice.recurring?.interval === "month"
      && configuredPrice.unit_amount === monthlyAmount;

    if (!isValidConfiguredPrice) {
      throw new Error(`Configured Stripe price ${configuredPriceId} does not match expected monthly billing settings`);
    }

    return configuredPriceId;
  }

  if (shouldRequireConfiguredPriceIds()) {
    throw new Error("Missing configured Stripe price ID for selected plan/tier");
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

  // Fallback: reuse an active monthly USD price with the expected amount to avoid
  // creating duplicate Stripe prices when metadata is missing on legacy/manual prices.
  const amountMatchedPrice = existingPrices.data.find((price) => {
    return price.currency === "usd"
      && price.unit_amount === monthlyAmount
      && price.type === "recurring"
      && price.recurring?.interval === "month";
  });

  if (amountMatchedPrice) {
    return amountMatchedPrice.id;
  }

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: monthlyAmount,
    recurring: { interval: "month" },
    product_data: {
      name:
        targetPlan === "premium"
          ? "LeadSig Elo Accelerator Monthly"
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

    // Fallback for legacy/manual customers missing account metadata.
    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0].id;
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

type AccountMemberForCap = {
  id: string;
  role: "owner" | "admin" | "sales" | "crew_member" | string;
  is_active: boolean;
  joined_at: string | null;
  created_at: string | null;
};

function getTargetMemberCap(plan: PlanKey, tier: BasicTier | null): number | null {
  if (plan === "free") return 1;
  if (plan !== "basic") return null;
  if (tier === "solo") return 1;
  if (tier === "team") return 5;
  return null;
}

async function deactivateMembersOverPlanLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  accountId: string,
  targetPlan: PlanKey,
  targetTier: BasicTier | null,
): Promise<void> {
  const memberCap = getTargetMemberCap(targetPlan, targetTier);
  if (memberCap === null) return;

  const { data: membersData, error: membersError } = await supabaseAdmin
    .from("account_members")
    .select("id, role, is_active, joined_at, created_at")
    .eq("account_id", accountId);

  if (membersError) {
    throw new Error(`Failed to load account members for seat enforcement: ${membersError.message}`);
  }

  const members = ((membersData ?? []) as AccountMemberForCap[]).filter((member) => member.is_active);
  if (members.length <= memberCap) return;

  const rolePriority = (role: string) => {
    if (role === "owner") return 0;
    if (role === "admin") return 1;
    if (role === "sales") return 2;
    return 3;
  };

  const sorted = [...members].sort((a, b) => {
    const byRole = rolePriority(a.role) - rolePriority(b.role);
    if (byRole !== 0) return byRole;
    const aTime = new Date(a.joined_at ?? a.created_at ?? "").getTime();
    const bTime = new Date(b.joined_at ?? b.created_at ?? "").getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });

  const keepIds = new Set(sorted.slice(0, memberCap).map((member) => member.id));
  const deactivateIds = sorted.filter((member) => !keepIds.has(member.id)).map((member) => member.id);
  if (deactivateIds.length === 0) return;

  const deactivationReason = `Inactive due to plan downgrade: ${targetPlan}${targetTier ? ` (${targetTier})` : ""} allows only ${memberCap} active member${memberCap === 1 ? "" : "s"}.`;

  const { error: updateError } = await supabaseAdmin
    .from("account_members")
    .update({
      is_active: false,
      inactive_reason: deactivationReason,
      updated_at: new Date().toISOString(),
    })
    .in("id", deactivateIds);

  if (updateError) {
    throw new Error(`Failed to deactivate extra members for downgraded plan: ${updateError.message}`);
  }
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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Billing service is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const body = await req.json();
    const accountId: string | undefined = body?.accountId;
    const targetPlanRaw: string | undefined = body?.targetPlan;
    const targetTierRaw: string | null = body?.targetTier ?? null;
    const requestedTrialDays = Number(body?.trialDays ?? 0);
    const trialDays =
      targetPlanRaw === "basic" && Number.isFinite(requestedTrialDays) && requestedTrialDays > 0
        ? Math.min(14, Math.floor(requestedTrialDays))
        : 0;
    const returnUrl: string = body?.returnUrl || `${new URL(req.url).origin}/settings/pricing`;

    if (!accountId || !targetPlanRaw) {
      throw new Error("accountId and targetPlan are required");
    }

    if (!isPlanKey(targetPlanRaw)) {
      throw new Error("Invalid targetPlan");
    }
    const targetPlan: PlanKey = targetPlanRaw;

    const targetTier: BasicTier | null =
      targetTierRaw === null || targetTierRaw === "" ? null : isBasicTier(targetTierRaw) ? targetTierRaw : null;

    if (targetPlan === "basic" && !targetTier) {
      throw new Error("targetTier is required when selecting the Basic plan");
    }

    if (targetPlan !== "basic" && targetTier) {
      throw new Error("targetTier is only valid for the Basic plan");
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

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id, company_name, company_email, pricing_plan, premium_setup_fee_paid, stripe_subscription_id")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error(accountError?.message || "Account not found");
    }

    const stripe = stripeSecretKey
      ? new Stripe(stripeSecretKey, {
          apiVersion: "2024-12-18.acacia",
        })
      : null;

    const targetPriceId =
      targetPlan === "free"
        ? null
        : stripe
        ? await getOrCreateRecurringPriceId(stripe, targetPlan, targetTier)
        : null;

    if (targetPlan !== "free" && (!stripe || !targetPriceId)) {
      throw new Error("Stripe billing is not configured");
    }

    let stripeCustomerId: string | null = null;
    let existingSubscription: Stripe.Subscription | null = null;
    if (stripe) {
      // First try direct subscription lookup from our own DB pointer.
      if (account.stripe_subscription_id) {
        try {
          const byId = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
          if ([ "trialing", "active", "past_due", "unpaid" ].includes(byId.status)) {
            existingSubscription = byId;
            stripeCustomerId = typeof byId.customer === "string" ? byId.customer : byId.customer?.id ?? null;
          }
        } catch {
          // Fall back to customer lookup if the stored id is stale.
        }
      }

      if (!stripeCustomerId) {
        stripeCustomerId = await getOrCreateStripeCustomerId(
          stripe,
          accountId,
          account.company_email,
          account.company_name
        );
      }

      if (!existingSubscription && stripeCustomerId) {
        existingSubscription = await getActiveSubscriptionForCustomer(stripe, stripeCustomerId);
      }
    }

    if (targetPlan === "free") {
      if (stripe && existingSubscription) {
        await stripe.subscriptions.cancel(existingSubscription.id);
      }

      const { error: updateError } = await supabaseAdmin
        .from("accounts")
        .update({
          pricing_plan: "free",
          pricing_tier: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      if (updateError) {
        throw new Error(`Failed to persist free plan state: ${updateError.message}`);
      }

      await deactivateMembersOverPlanLimit(supabaseAdmin, accountId, "free", null);

      return new Response(
        JSON.stringify({
          success: true,
          message: stripe
            ? "Plan moved to Free. Stripe subscription canceled."
            : "Plan moved to Free.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const shouldChargePremiumSetupFee = targetPlan === "premium" && !account.premium_setup_fee_paid;
    const testCouponId = getConfiguredTestCouponId();
    let applyTestCouponId: string | null = null;
    if (testCouponId) {
      try {
        const coupon = await stripe!.coupons.retrieve(testCouponId);
        if (coupon && coupon.valid) {
          applyTestCouponId = testCouponId;
        }
      } catch (couponError) {
        console.warn("Configured STRIPE_TEST_COUPON_ID is invalid for this Stripe account:", couponError);
      }
    }

    if (!existingSubscription) {
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price: targetPriceId,
          quantity: 1,
        },
      ];

      if (shouldChargePremiumSetupFee) {
        lineItems.push({
          price_data: {
            currency: "usd",
            unit_amount: PREMIUM_SETUP_FEE_CENTS,
            product_data: {
              name: "LeadSig Elo Accelerator Setup Fee",
            },
          },
          quantity: 1,
        });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId!,
        line_items: lineItems,
        ...(applyTestCouponId
          ? { discounts: [{ coupon: applyTestCouponId }] }
          : { allow_promotion_codes: true }),
        success_url: `${returnUrl}?billing=success`,
        cancel_url: `${returnUrl}?billing=canceled`,
        metadata: {
          account_id: accountId,
          target_plan: targetPlan,
          target_tier: targetTier ?? "",
          premium_setup_applied: shouldChargePremiumSetupFee ? "true" : "false",
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
          price: targetPriceId,
        },
      ],
      proration_behavior: "create_prorations",
      metadata: {
        account_id: accountId,
        target_plan: targetPlan,
        target_tier: targetTier ?? "",
      },
    });

    if (shouldChargePremiumSetupFee) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId!,
        amount: PREMIUM_SETUP_FEE_CENTS,
        currency: "usd",
        description: "LeadSig Elo Accelerator setup fee",
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

    const { error: updateError } = await supabaseAdmin
      .from("accounts")
      .update({
        pricing_plan: targetPlan,
        pricing_tier: targetPlan === "basic" ? targetTier : null,
        stripe_subscription_id: existingSubscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (updateError) {
      throw new Error(`Failed to persist account billing changes: ${updateError.message}`);
    }

    await deactivateMembersOverPlanLimit(supabaseAdmin, accountId, targetPlan, targetTier);

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
