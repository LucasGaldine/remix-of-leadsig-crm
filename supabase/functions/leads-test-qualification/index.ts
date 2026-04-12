import { createClient } from "npm:@supabase/supabase-js@2";
import {
  evaluateIntegrationQualificationDecision,
  getIntegrationAutomationSettings,
} from "../_shared/integration-lead-automation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type TestLeadPayload = {
  accountId?: string;
  source?: string;
  lead?: {
    full_name?: string;
    email?: string;
    phone_number?: string;
    budget?: number | string;
    service_type?: string;
    address?: string;
    city?: string;
    state?: string;
    notes?: string;
  };
};

function parseBudget(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = (await req.json()) as TestLeadPayload;
    const accountId = typeof payload.accountId === "string" ? payload.accountId : "";
    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const authedSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await authedSupabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership, error: membershipError } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("account_id", accountId)
        .eq("is_active", true)
        .maybeSingle();

      if (membershipError || !membership) {
        return new Response(JSON.stringify({ error: "Unauthorized for this account" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const automationSettings = await getIntegrationAutomationSettings(supabase, accountId);

    const leadData = {
      full_name: payload.lead?.full_name?.trim() || null,
      email: payload.lead?.email?.trim() || null,
      phone_number: payload.lead?.phone_number?.trim() || null,
      budget: parseBudget(payload.lead?.budget),
      service_type: payload.lead?.service_type?.trim() || null,
      address: payload.lead?.address?.trim() || null,
      city: payload.lead?.city?.trim() || null,
      state: payload.lead?.state?.trim() || null,
      notes: payload.lead?.notes?.trim() || null,
    };

    const source = typeof payload.source === "string" && payload.source.trim().length > 0
      ? payload.source.trim()
      : "manual_test";

    const decision = await evaluateIntegrationQualificationDecision({
      automationSettings,
      accountId,
      source,
      leadData,
      rawPayload: {
        event: "settings_test_qualification",
        source,
        lead: leadData,
      },
    });
    const status = decision.reason === "Auto-qualify disabled"
      ? "neutral"
      : decision.qualified
        ? "qualified"
        : "rejected";

    return new Response(
      JSON.stringify({
        status,
        qualified: decision.qualified,
        rejected: status === "rejected",
        reason: decision.reason,
        metadata: decision.metadata,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
