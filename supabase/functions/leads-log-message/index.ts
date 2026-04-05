import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateApiKey, corsHeaders, jsonResponse, resolveLeadId } from "../_shared/leads-webhook-utils.ts";
import { normalizeInteractionMetadataWithPostLink } from "../_shared/post-links.ts";

interface MessagePayload {
  lead_id?: string;
  leadId?: string;
  client?: Record<string, unknown>;
  summary?: string;
  message?: string;
  body?: string;
  direction?: "inbound" | "outbound" | "na";
  post_url?: string;
  postUrl?: string;
  post_link?: string;
  postLink?: string;
  url?: string;
  link?: string;
  platform?: string;
  platform_name?: string;
  platformName?: string;
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

    const payload = await req.json() as MessagePayload;
    const messageBody = payload.message?.trim() || payload.body?.trim();

    if (!messageBody) {
      return jsonResponse({ error: "message (or body) is required" }, 400);
    }

    const leadResolution = await resolveLeadId(
      supabase,
      auth.accountId,
      payload as Record<string, unknown>,
    );

    if (!leadResolution.leadId) {
      return jsonResponse({ error: leadResolution.error || "Lead not found" }, 404);
    }

    const normalizedMetadata = normalizeInteractionMetadataWithPostLink(
      payload as Record<string, unknown>,
      payload.metadata,
      messageBody,
      payload.summary,
    );

    const { data: interaction, error } = await supabase
      .from("interactions")
      .insert({
        lead_id: leadResolution.leadId,
        type: "text",
        direction: payload.direction || "inbound",
        summary: payload.summary || "Message logged by automation",
        body: messageBody,
        metadata: normalizedMetadata || {},
      })
      .select("id, lead_id, type, direction, summary, body, metadata, created_at")
      .single();

    if (error) {
      console.error("leads-log-message: failed to insert interaction", error);
      return jsonResponse({ error: "Failed to log message" }, 500);
    }

    return jsonResponse({ success: true, interaction }, 201);
  } catch (error) {
    console.error("leads-log-message: error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
