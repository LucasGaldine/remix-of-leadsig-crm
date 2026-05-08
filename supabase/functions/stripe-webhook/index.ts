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
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isMembershipActiveStatus(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active";
}

type MembershipLifecycleStatus = "active" | "inactive" | "canceled" | "past_due" | "grace";

type GrowthSignupRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
};

function toMembershipStatus(status: string | null | undefined): MembershipLifecycleStatus {
  switch (status) {
    case "trialing":
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "inactive";
  }
}

async function syncGhlMembershipContact(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string | null;
    fullName?: string | null;
    phone?: string | null;
    companyName?: string | null;
    membershipStatus?: string | null;
    source: string;
  },
) {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) return;

  const { data: signupRow, error: signupError } = await supabase
    .from("elo_growth_signups")
    .select("id, full_name, phone, metadata")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle<GrowthSignupRow>();

  if (signupError || !signupRow) {
    if (signupError) {
      console.error("Failed loading signup row before GHL sync:", signupError.message);
    }
    return;
  }

  const metadata = (signupRow.metadata || {}) as Record<string, unknown>;
  const resolvedMembershipStatus = toMembershipStatus(params.membershipStatus);
  const previousMembershipStatus = String(metadata.ghl_membership_status || "");
  if (
    metadata.ghl_membership_status_synced_at
    && previousMembershipStatus === resolvedMembershipStatus
  ) {
    return;
  }

  const fullName = (params.fullName || signupRow.full_name || "ELO Member").trim();
  const phone = (params.phone || signupRow.phone || "").trim();
  const companyName = (params.companyName || String(metadata.company_name || "") || "ELO Membership").trim();
  if (!phone) {
    console.warn("Skipping GHL sync: missing phone for", normalizedEmail);
    return;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Skipping GHL sync: missing Supabase service credentials");
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ghl-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        name: fullName,
        email: normalizedEmail,
        business: companyName,
        phone,
        membership_status: resolvedMembershipStatus,
        membership_source: params.source,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("GHL sync failed:", response.status, body.slice(0, 500));
      return;
    }

    const updatedMetadata = {
      ...metadata,
      ghl_contact_synced_at: new Date().toISOString(),
      ghl_contact_sync_source: params.source,
      ghl_contact_sync_email: normalizedEmail,
      ghl_membership_status: resolvedMembershipStatus,
      ghl_membership_status_synced_at: new Date().toISOString(),
      ghl_membership_status_sync_source: params.source,
    };

    const { error: metadataUpdateError } = await supabase
      .from("elo_growth_signups")
      .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
      .eq("id", signupRow.id);

    if (metadataUpdateError) {
      console.error("Failed to persist GHL sync metadata:", metadataUpdateError.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GHL sync exception:", message);
  }
}

async function upsertEloMembership(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string | null;
    membershipStatus: string | null;
    plan: string | null;
    source: string;
    eloMemberId?: string | null;
    currentPeriodEndUnix?: number | null;
    metadata?: Record<string, unknown>;
  },
) {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) return;

  const payload = {
    normalized_email: normalizedEmail,
    elo_member_id: params.eloMemberId ?? null,
    status: toMembershipStatus(params.membershipStatus),
    plan: params.plan || "growth",
    source: params.source,
    current_period_end: params.currentPeriodEndUnix
      ? new Date(params.currentPeriodEndUnix * 1000).toISOString()
      : null,
    last_checked_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    metadata: params.metadata ?? {},
  };

  const { error } = await supabase
    .from("elo_memberships")
    .upsert(payload, { onConflict: "normalized_email" });

  if (error) {
    console.error("Failed to upsert elo_memberships:", error.message);
  }
}

async function syncEloGrowthSignupByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string | null,
  values: {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    stripe_subscription_status?: string | null;
    updated_at: string;
  },
  options: {
    full_name?: string | null;
    phone?: string | null;
    elo_user_id?: string | null;
    metadata?: Record<string, unknown> | null;
    expected_plan?: string | null;
    expected_tier?: string | null;
  } = {},
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const payload = {
    email: normalizedEmail,
    normalized_email: normalizedEmail,
    full_name: options.full_name || "ELO Member",
    elo_user_id: options.elo_user_id || `elo_${crypto.randomUUID()}`,
    phone: options.phone || null,
    metadata: options.metadata || {},
    signup_source: "elo_landing_page",
    expected_plan: options.expected_plan || "basic",
    expected_tier: options.expected_tier || "growth",
    membership_active: isMembershipActiveStatus(values.stripe_subscription_status),
    ...values,
  };

  const { error } = await supabase
    .from("elo_growth_signups")
    .upsert(payload, { onConflict: "normalized_email" });

  if (error) {
    console.error("Failed to sync elo_growth_signups by email:", error.message);
  }
}

async function syncEloGrowthSignupByStripeIds(
  supabase: ReturnType<typeof createClient>,
  params: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeSubscriptionStatus: string | null;
  },
) {
  const { stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus } = params;
  if (!stripeCustomerId && !stripeSubscriptionId) return;

  const nowIso = new Date().toISOString();
  const baseUpdate = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_subscription_status: stripeSubscriptionStatus,
    membership_active: isMembershipActiveStatus(stripeSubscriptionStatus),
    updated_at: nowIso,
  };

  if (stripeSubscriptionId) {
    const { data, error } = await supabase
      .from("elo_growth_signups")
      .update(baseUpdate)
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Failed to sync elo_growth_signups by subscription:", error.message);
      return;
    }

    if (data) return;
  }

  if (stripeCustomerId) {
    const { error } = await supabase
      .from("elo_growth_signups")
      .update(baseUpdate)
      .eq("stripe_customer_id", stripeCustomerId);

    if (error) {
      console.error("Failed to sync elo_growth_signups by customer:", error.message);
    }
  }
}

function inferTierFromSubscription(subscription: Stripe.Subscription): BasicTier | null {
  for (const item of subscription.items.data) {
    const metadataTier = item.price?.metadata?.leadsig_tier ?? "";
    if (isBasicTier(metadataTier)) {
      return metadataTier;
    }
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
    if (isPlanKey(metadataPlan)) {
      return metadataPlan;
    }
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
      return new Response(
        JSON.stringify({ error: "Stripe webhook not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing webhook event:", event.type, event.id);

    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(supabase, checkoutSession);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChanged(supabase, subscription, event.type);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(supabase, paymentIntent);
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, paymentIntent);
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }
      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  if (invoice.metadata?.billing_event === "premium_setup_fee" && invoice.metadata?.account_id) {
    const { error } = await supabase
      .from("accounts")
      .update({
        premium_setup_fee_paid: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.metadata.account_id);

    if (error) {
      console.error("Failed to mark premium setup fee as paid:", error.message);
    }
  }

  const stripeInvoiceId = invoice.id;
  console.log("Invoice paid:", stripeInvoiceId);

  const { data: localInvoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, total, customer_id, account_id")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .maybeSingle();

  if (fetchError || !localInvoice) {
    console.log("No matching local invoice for:", stripeInvoiceId);
    return;
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      balance_due: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", localInvoice.id);

  if (updateError) {
    console.error("Failed to update invoice:", updateError.message);
    return;
  }

  const amountPaid = invoice.amount_paid ? invoice.amount_paid / 100 : Number(localInvoice.total);

  if (!invoice.charge) {
    const { data: existingOfflinePayment } = await supabase
      .from("payments")
      .select("id")
      .eq("invoice_id", localInvoice.id)
      .eq("transaction_ref", stripeInvoiceId)
      .maybeSingle();

    if (existingOfflinePayment) {
      console.log("Skipping duplicate offline payment insert for:", stripeInvoiceId);
      return;
    }
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: localInvoice.id,
    customer_id: localInvoice.customer_id,
    account_id: localInvoice.account_id,
    amount: amountPaid,
    method: "card",
    status: "completed",
    transaction_ref: invoice.charge ? String(invoice.charge) : null,
    receipt_url: invoice.hosted_invoice_url || null,
    notes: "Paid via Stripe invoice",
  });

  if (paymentError) {
    console.error("Failed to create payment record:", paymentError.message);
  }

  console.log("Invoice marked as paid:", localInvoice.id);
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const stripeInvoiceId = invoice.id;
  console.log("Invoice payment failed:", stripeInvoiceId);

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "overdue",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_invoice_id", stripeInvoiceId);

  if (error) {
    console.error("Failed to update invoice status:", error.message);
  }
}

async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const piId = paymentIntent.id;
  console.log("PaymentIntent succeeded:", piId);

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("id, invoice_id, amount")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  let resolvedPayment = payment;
  if (fetchError || !resolvedPayment) {
    const invoiceId = paymentIntent.metadata?.invoice_id || null;
    const customerId = paymentIntent.metadata?.customer_id || null;
    const accountId = paymentIntent.metadata?.account_id || null;
    const leadId = paymentIntent.metadata?.lead_id || null;

    if (!invoiceId || !customerId || !accountId) {
      console.log("No matching local payment for:", piId, "and metadata is incomplete");
      return;
    }

    const { data: insertedPayment, error: insertError } = await supabase
      .from("payments")
      .insert({
        invoice_id: invoiceId,
        customer_id: customerId,
        lead_id: leadId,
        account_id: accountId,
        amount: (paymentIntent.amount_received || paymentIntent.amount || 0) / 100,
        method: "card",
        status: "completed",
        stripe_payment_intent_id: piId,
        transaction_ref: paymentIntent.latest_charge
          ? String(
              typeof paymentIntent.latest_charge === "object"
                ? paymentIntent.latest_charge.id
                : paymentIntent.latest_charge,
            )
          : null,
      })
      .select("id, invoice_id, amount")
      .single();

    if (insertError || !insertedPayment) {
      console.error("Failed to create fallback payment record from payment intent:", insertError?.message);
      return;
    }

    resolvedPayment = insertedPayment;
  }

  const receiptUrl =
    paymentIntent.latest_charge &&
    typeof paymentIntent.latest_charge === "object"
      ? (paymentIntent.latest_charge as Stripe.Charge).receipt_url
      : null;

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "completed",
      transaction_ref: paymentIntent.latest_charge
        ? String(
            typeof paymentIntent.latest_charge === "object"
              ? paymentIntent.latest_charge.id
              : paymentIntent.latest_charge
          )
        : null,
      receipt_url: receiptUrl,
    })
    .eq("id", resolvedPayment.id);

  if (updateError) {
    console.error("Failed to update payment:", updateError.message);
    return;
  }

  if (resolvedPayment.invoice_id) {
    const paymentAmount = Number(
      resolvedPayment.amount ||
      (paymentIntent.amount_received ? paymentIntent.amount_received / 100 : 0),
    );
    const { data: invoiceRecord, error: invoiceFetchError } = await supabase
      .from("invoices")
      .select("id, balance_due")
      .eq("id", resolvedPayment.invoice_id)
      .maybeSingle();

    if (invoiceFetchError || !invoiceRecord) {
      console.error("Failed to fetch invoice for payment intent:", invoiceFetchError?.message);
      return;
    }

    const currentBalance = Number(invoiceRecord.balance_due || 0);
    const nextBalance = Math.max(0, currentBalance - paymentAmount);
    const isPaid = nextBalance <= 0;

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        status: isPaid ? "paid" : "partial",
        paid_at: isPaid ? new Date().toISOString() : null,
        balance_due: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolvedPayment.invoice_id);

    if (invoiceError) {
      console.error("Failed to update invoice:", invoiceError.message);
    }
  }

  console.log("Payment completed:", resolvedPayment.id);
}

async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  const piId = paymentIntent.id;
  console.log("PaymentIntent failed:", piId);

  const { error } = await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error("Failed to update payment status:", error.message);
  }
}

async function handleAccountUpdated(
  supabase: ReturnType<typeof createClient>,
  account: Stripe.Account
) {
  const stripeAccountId = account.id;
  console.log("Account updated:", stripeAccountId);

  const requirements = account.requirements?.currently_due || [];
  let status = "active";
  if (requirements.length > 0) {
    status = "action_required";
  } else if (!account.charges_enabled || !account.payouts_enabled) {
    status = "pending";
  }

  const { error } = await supabase
    .from("stripe_connect_accounts")
    .update({
      account_status: status,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      details_submitted: account.details_submitted || false,
      stripe_account_email: account.email,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_user_id", stripeAccountId);

  if (error) {
    console.error("Failed to update Stripe account:", error.message);
  }
}

async function handleCheckoutSessionCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const nowIso = new Date().toISOString();
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const checkoutEmail =
    session.customer_details?.email ??
    session.customer_email ??
    session.metadata?.email ??
    session.metadata?.normalized_email ??
    null;
  const isPaid = session.payment_status === "paid";

  await syncEloGrowthSignupByEmail(supabase, checkoutEmail, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_subscription_status: isPaid ? "active" : null,
    updated_at: nowIso,
  }, {
    full_name: session.metadata?.full_name ?? null,
    phone: session.metadata?.phone ?? null,
    elo_user_id: session.metadata?.elo_user_id ?? null,
    metadata: session.metadata ?? {},
    expected_plan: session.metadata?.target_plan ?? "basic",
    expected_tier: session.metadata?.target_tier ?? "growth",
  });

  await upsertEloMembership(supabase, {
    email: checkoutEmail,
    membershipStatus: isPaid ? "active" : null,
    plan: session.metadata?.target_tier ?? "growth",
    source: "stripe_checkout_session_completed",
    eloMemberId: session.metadata?.elo_user_id ?? null,
    metadata: {
      stripe_checkout_session_id: session.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      raw_metadata: session.metadata ?? {},
    },
  });

  if (isPaid) {
    await syncGhlMembershipContact(supabase, {
      email: checkoutEmail,
      fullName: session.metadata?.full_name ?? null,
      phone: session.metadata?.phone ?? null,
      companyName: session.metadata?.company_name ?? null,
      membershipStatus: "active",
      source: "stripe_checkout_session_completed",
    });
  }

  if (session.mode !== "subscription") {
    return;
  }

  const accountId = session.metadata?.account_id;
  const targetPlan = session.metadata?.target_plan;
  const targetTier = session.metadata?.target_tier ?? "";
  if (!accountId || !targetPlan || !isPlanKey(targetPlan)) {
    return;
  }

  const normalizedTier = targetPlan === "basic" && isBasicTier(targetTier) ? targetTier : null;

  const { error } = await supabase
    .from("accounts")
    .update({
      pricing_plan: targetPlan,
      pricing_tier: normalizedTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    console.error("Failed to sync checkout session:", error.message);
  }
}

async function handleSubscriptionChanged(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  eventType: string
) {
  const nowIso = new Date().toISOString();
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const metadataEmail = normalizeEmail(
    subscription.metadata?.normalized_email
      ?? subscription.metadata?.email
      ?? null,
  );
  if (metadataEmail) {
    await syncEloGrowthSignupByEmail(supabase, metadataEmail, {
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      updated_at: nowIso,
    }, {
      full_name: subscription.metadata?.full_name ?? null,
      phone: subscription.metadata?.phone ?? null,
      elo_user_id: subscription.metadata?.elo_user_id ?? null,
      metadata: subscription.metadata ?? {},
      expected_plan: subscription.metadata?.target_plan ?? "basic",
      expected_tier: subscription.metadata?.target_tier ?? "growth",
    });
  }

  await syncEloGrowthSignupByStripeIds(supabase, {
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
  });

  // We may only have Stripe IDs on subscription events; recover email from the signup row.
  let resolvedEmail = metadataEmail;
  if (!resolvedEmail) {
    let signupLookup = supabase
      .from("elo_growth_signups")
      .select("email, normalized_email")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    let { data: signupRow } = await signupLookup;
    if (!signupRow && stripeCustomerId) {
      const byCustomer = await supabase
        .from("elo_growth_signups")
        .select("email, normalized_email")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();
      signupRow = byCustomer.data ?? null;
    }

    resolvedEmail = normalizeEmail(signupRow?.normalized_email ?? signupRow?.email ?? null);
  }

  await upsertEloMembership(supabase, {
    email: resolvedEmail,
    membershipStatus: subscription.status,
    plan: subscription.metadata?.target_tier ?? "growth",
    source: `stripe_${eventType.replaceAll(".", "_")}`,
    eloMemberId: subscription.metadata?.elo_user_id ?? null,
    currentPeriodEndUnix: subscription.current_period_end ?? null,
    metadata: {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomerId,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      cancel_at: subscription.cancel_at,
      canceled_at: subscription.canceled_at,
      target_plan: subscription.metadata?.target_plan ?? null,
      target_tier: subscription.metadata?.target_tier ?? null,
      raw_metadata: subscription.metadata ?? {},
    },
  });

  await syncGhlMembershipContact(supabase, {
    email: resolvedEmail,
    fullName: subscription.metadata?.full_name ?? null,
    phone: subscription.metadata?.phone ?? null,
    companyName: subscription.metadata?.company_name ?? null,
    membershipStatus: subscription.status,
    source: `stripe_${eventType.replaceAll(".", "_")}`,
  });

  const accountIdFromMetadata = subscription.metadata?.account_id || null;

  const accountLookup = accountIdFromMetadata
    ? supabase
        .from("accounts")
        .select("id, pricing_plan, pricing_tier")
        .eq("id", accountIdFromMetadata)
        .maybeSingle()
    : supabase
        .from("accounts")
        .select("id, pricing_plan, pricing_tier")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

  const { data: account, error: accountError } = await accountLookup;

  if (accountError || !account) {
    return;
  }

  const isDeleted = eventType === "customer.subscription.deleted";
  const targetPlanFromMetadata = subscription.metadata?.target_plan;
  const targetTierFromMetadata = subscription.metadata?.target_tier ?? "";
  const inferredPlan = inferPlanFromSubscription(subscription);
  const inferredTier = inferTierFromSubscription(subscription);
  const resolvedPlan =
    !isDeleted && targetPlanFromMetadata && isPlanKey(targetPlanFromMetadata)
      ? targetPlanFromMetadata
      : !isDeleted && inferredPlan
      ? inferredPlan
      : account.pricing_plan;
  const resolvedTier =
    !isDeleted && resolvedPlan === "basic"
      ? isBasicTier(targetTierFromMetadata)
        ? targetTierFromMetadata
        : inferredTier
        ? inferredTier
        : isBasicTier(account.pricing_tier)
        ? account.pricing_tier
        : null
      : null;

  const { error } = await supabase
    .from("accounts")
    .update({
      pricing_plan: isDeleted ? "free" : resolvedPlan,
      pricing_tier: isDeleted ? null : resolvedTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  if (error) {
    console.error("Failed to sync subscription:", error.message);
  }
}
