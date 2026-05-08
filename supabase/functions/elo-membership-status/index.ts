import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MembershipStatus = "free" | "premium";

type EloMembershipRow = {
  id: string;
  status: "active" | "inactive" | "canceled" | "past_due" | "grace";
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isMembershipActiveStatus(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active";
}

function toMembershipLifecycleStatus(status: string | null | undefined): EloMembershipRow["status"] {
  if (status === "active" || status === "trialing") return "active";
  if (status === "canceled") return "canceled";
  if (status === "past_due") return "past_due";
  return "inactive";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Supabase service credentials are not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    let email: string | null = null;
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (req.method === "GET" && sessionId) {
      const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecretKey) {
        return jsonResponse({ error: "STRIPE_SECRET_KEY is not configured" }, 500);
      }

      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
      email = normalizeEmail(
        session.customer_details?.email
          ?? session.customer_email
          ?? session.metadata?.normalized_email
          ?? session.metadata?.email
          ?? null,
      );

      const subscription = typeof session.subscription === "object" ? session.subscription : null;
      const subscriptionId = subscription?.id ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const subscriptionStatus = subscription?.status ?? null;
      const paidLikeStatus = isMembershipActiveStatus(subscriptionStatus);

      if (email) {
        await supabase
          .from("elo_growth_signups")
          .upsert({
            email,
            normalized_email: email,
            full_name: session.metadata?.full_name || "ELO Member",
            elo_user_id: session.metadata?.elo_user_id || `elo_${crypto.randomUUID()}`,
            phone: session.metadata?.phone || null,
            metadata: session.metadata || {},
            signup_source: "elo_landing_page",
            expected_plan: session.metadata?.target_plan || "basic",
            expected_tier: session.metadata?.target_tier || "growth",
            membership_active: paidLikeStatus,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_subscription_status: subscriptionStatus,
            updated_at: new Date().toISOString(),
          }, { onConflict: "normalized_email" });

        await supabase
          .from("elo_memberships")
          .upsert({
            normalized_email: email,
            elo_member_id: session.metadata?.elo_user_id || null,
            status: toMembershipLifecycleStatus(subscriptionStatus),
            plan: session.metadata?.target_tier || "growth",
            source: "elo_membership_status_session_lookup",
            current_period_end: subscription?.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            last_checked_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
            metadata: {
              stripe_checkout_session_id: session.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_subscription_status: subscriptionStatus,
              raw_metadata: session.metadata || {},
            },
          }, { onConflict: "normalized_email" });
      }
    } else {
      const body = (await req.json()) as { email?: string };
      email = normalizeEmail(body.email);
    }

    if (!email) return jsonResponse({ error: "email or session_id is required" }, 400);

    const { data: membership } = await supabase
      .from("elo_memberships")
      .select("id, status")
      .eq("normalized_email", email)
      .maybeSingle<EloMembershipRow>();

    if (membership) {
      await supabase
        .from("elo_memberships")
        .update({ last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", membership.id);

      return jsonResponse({
        status: (membership.status === "active" || membership.status === "grace" ? "premium" : "free") satisfies MembershipStatus,
        eligibility: membership.status === "active" || membership.status === "grace" ? "approved" : "denied",
        source: "elo_memberships_table",
        plan: membership.status === "active" || membership.status === "grace" ? "basic" : undefined,
        tier: membership.status === "active" || membership.status === "grace" ? "growth" : undefined,
      });
    }

    return jsonResponse({
      status: "free" satisfies MembershipStatus,
      eligibility: "denied",
      source: "elo_memberships_table",
      reason: "No Elo membership record found for this email",
    });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message || "Unknown error" }, 500);
  }
});
