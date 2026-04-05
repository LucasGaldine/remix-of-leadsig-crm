import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateApiKey, corsHeaders, jsonResponse, resolveLeadId } from "../_shared/leads-webhook-utils.ts";

interface CallPayload {
  lead_id?: string;
  leadId?: string;
  client?: Record<string, unknown>;
  summary?: string;
  notes?: string;
  body?: string;
  direction?: "inbound" | "outbound" | "na";
  duration_seconds?: number;
  durationSeconds?: number;
  call_outcome?: string;
  callOutcome?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const apiKey = req.headers.get("x-leadsig-api-key");
    if (!apiKey) {
      return jsonResponse({ error: "Missing x-leadsig-api-key header" }, 401);
    }

    const auth = await authenticateApiKey(supabase, apiKey);
    if ("error" in auth) {
      return jsonResponse({ error: auth.error }, 401);
    }

    const payload = await req.json() as CallPayload;
    const callBody = payload.notes?.trim() || payload.body?.trim() || "Call logged by intake automation";

    const leadResolution = await resolveLeadId(
      supabase,
      auth.accountId,
      payload as Record<string, unknown>,
    );

    if (!leadResolution.leadId) {
      return jsonResponse({ error: leadResolution.error || "Lead not found" }, 404);
    }

    const durationSeconds = Number.isFinite(payload.duration_seconds)
      ? payload.duration_seconds
      : Number.isFinite(payload.durationSeconds)
        ? payload.durationSeconds
        : null;

    const callOutcome = payload.call_outcome || payload.callOutcome || null;

    const { data: interaction, error } = await supabase
      .from("interactions")
      .insert({
        lead_id: leadResolution.leadId,
        type: "call",
        direction: payload.direction || "inbound",
        summary: payload.summary || "Call logged by intake automation",
        body: callBody,
        metadata: {
          ...(payload.metadata || {}),
          duration_seconds: durationSeconds,
          call_outcome: callOutcome,
        },
      })
      .select("id, lead_id, type, direction, summary, body, metadata, created_at")
      .single();

    if (error) {
      console.error("leads-log-call: failed to insert interaction", error);
      return jsonResponse({ error: "Failed to log call" }, 500);
    }

    return jsonResponse({ success: true, interaction }, 201);
  } catch (error) {
    console.error("leads-log-call: error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
