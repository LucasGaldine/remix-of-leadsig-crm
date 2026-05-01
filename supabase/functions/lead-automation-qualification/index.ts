import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-LeadSig-Webhook-Token",
};

type QualificationPayload = {
  account_id?: string;
  accountId?: string;
  lead_id?: string;
  leadId?: string;
  qualified?: boolean | string | number;
  is_qualified?: boolean | string | number;
  isQualified?: boolean | string | number;
  reason?: string | null;
  qualification_reason?: string | null;
  qualificationReason?: string | null;
  address?: string | null;
  lead_address?: string | null;
  leadAddress?: string | null;
  city?: string | null;
  description?: string | null;
  project_description?: string | null;
  projectDescription?: string | null;
  homeowner?: boolean | string | number;
  is_homeowner?: boolean | string | number;
  isHomeowner?: boolean | string | number;
  decision_maker_confirmed?: boolean | string | number;
  decisionMakerConfirmed?: boolean | string | number;
  retell_chat_id?: string | null;
  retellChatId?: string | null;
  source?: string | null;
};

function firstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseQualified(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "qualified", "approve", "approved"].includes(normalized)) return true;
    if (["false", "0", "no", "not_qualified", "rejected", "reject"].includes(normalized)) return false;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore parse failures and return empty object
    }
  }
  return {};
}

function findDeepValue(obj: unknown, keys: string[], maxDepth = 6): unknown {
  const targetKeys = new Set(keys.map((k) => k.toLowerCase()));
  const visited = new Set<unknown>();

  function walk(value: unknown, depth: number): unknown {
    if (depth > maxDepth || value === null || value === undefined) return undefined;
    if (typeof value === "string") {
      const parsed = parseJsonObject(value);
      if (Object.keys(parsed).length > 0) return walk(parsed, depth + 1);
      return undefined;
    }
    if (typeof value !== "object") return undefined;
    if (visited.has(value)) return undefined;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    const record = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(record)) {
      if (targetKeys.has(k.toLowerCase()) && v !== undefined && v !== null) return v;
    }
    for (const v of Object.values(record)) {
      const found = walk(v, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  return walk(obj, 0);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const expectedToken = Deno.env.get("RETELL_QUALIFICATION_WEBHOOK_TOKEN")?.trim() || "";
    if (expectedToken) {
      const providedToken = req.headers.get("X-LeadSig-Webhook-Token")?.trim() || "";
      if (!providedToken || providedToken !== expectedToken) {
        return json({ error: "Unauthorized webhook token" }, 401);
      }
    }

    const payload = (await req.json()) as QualificationPayload & Record<string, unknown>;
    const payloadRecord = asRecord(payload);
    const argsRecord = parseJsonObject(payloadRecord.args ?? payloadRecord.arguments ?? payloadRecord.tool_args);

    const providedAccountId = firstNonEmptyString([
      payload?.account_id,
      payload?.accountId,
      argsRecord.account_id,
      argsRecord.accountId,
      findDeepValue(payloadRecord, ["account_id", "accountId"]),
    ]);
    const providedLeadId = firstNonEmptyString([
      payload?.lead_id,
      payload?.leadId,
      argsRecord.lead_id,
      argsRecord.leadId,
      findDeepValue(payloadRecord, ["lead_id", "leadId"]),
    ]);
    const qualified = parseQualified(
      payload?.qualified ?? payload?.is_qualified ?? payload?.isQualified ??
        argsRecord.qualified ?? argsRecord.is_qualified ?? argsRecord.isQualified ??
        findDeepValue(payloadRecord, ["qualified", "is_qualified", "isQualified"]),
    );
    const reason = firstNonEmptyString([
      payload?.reason,
      payload?.qualification_reason,
      payload?.qualificationReason,
      argsRecord.reason,
      argsRecord.qualification_reason,
      argsRecord.qualificationReason,
    ]);
    const address = firstNonEmptyString([
      payload?.address,
      payload?.lead_address,
      payload?.leadAddress,
      argsRecord.address,
      argsRecord.lead_address,
      argsRecord.leadAddress,
      argsRecord.street_address,
      argsRecord.streetAddress,
      findDeepValue(payloadRecord, ["address", "lead_address", "leadAddress", "street_address", "streetAddress"]),
    ]);
    const city = firstNonEmptyString([payload?.city, argsRecord.city, findDeepValue(payloadRecord, ["city"])]);
    const description = firstNonEmptyString([
      payload?.description,
      payload?.project_description,
      payload?.projectDescription,
      argsRecord.description,
      argsRecord.project_description,
      argsRecord.projectDescription,
      argsRecord.project_details,
      argsRecord.projectDetails,
      findDeepValue(payloadRecord, [
        "description",
        "project_description",
        "projectDescription",
        "project_details",
        "projectDetails",
      ]),
    ]);
    const retellChatId = firstNonEmptyString([
      payload?.retell_chat_id,
      payload?.retellChatId,
      argsRecord.retell_chat_id,
      argsRecord.retellChatId,
      payloadRecord.call_id,
      payloadRecord.callId,
      payloadRecord.chat_id,
      payloadRecord.chatId,
      findDeepValue(payloadRecord, ["retell_chat_id", "retellChatId", "chat_id", "chatId", "call_id", "callId"]),
    ]);
    const source = typeof payload?.source === "string" && payload.source.trim()
      ? payload.source.trim()
      : "retell_webhook";
    const homeowner = parseBoolean(
      payload?.homeowner ?? payload?.is_homeowner ?? payload?.isHomeowner ??
        payload?.decision_maker_confirmed ?? payload?.decisionMakerConfirmed ??
        argsRecord.homeowner ?? argsRecord.is_homeowner ?? argsRecord.isHomeowner ??
        argsRecord.decision_maker_confirmed ?? argsRecord.decisionMakerConfirmed ??
        findDeepValue(payloadRecord, [
          "homeowner",
          "is_homeowner",
          "isHomeowner",
          "decision_maker_confirmed",
          "decisionMakerConfirmed",
        ]),
    );

    if ((!providedLeadId && !retellChatId) || qualified === null) {
      return json({
        error: "Missing required fields: lead_id/leadId (or retell_chat_id) and qualified/is_qualified",
        debug: {
          payload_keys: Object.keys(payloadRecord),
          args_keys: Object.keys(argsRecord),
        },
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let resolvedLeadId = providedLeadId;
    if (!resolvedLeadId && retellChatId) {
      const { data: interactionLead, error: interactionLookupError } = await supabase
        .from("interactions")
        .select("lead_id")
        .eq("metadata->>retell_chat_id", retellChatId)
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (interactionLookupError) {
        return json({
          success: false,
          error: "Failed to resolve lead from retell_chat_id",
          debug: {
            message: interactionLookupError.message,
            code: interactionLookupError.code ?? null,
            details: interactionLookupError.details ?? null,
          },
        }, 500);
      }

      if (!interactionLead?.lead_id) {
        return json({
          success: false,
          error: "No lead found for retell_chat_id",
          debug: { retell_chat_id: retellChatId },
        }, 404);
      }

      resolvedLeadId = interactionLead.lead_id;
    }

    const { data: leadIdentity, error: identityError } = await supabase
      .from("leads")
      .select("id, account_id")
      .eq("id", resolvedLeadId)
      .maybeSingle();

    if (identityError || !leadIdentity?.id) {
      return json({
        success: false,
        error: "Lead not found",
        debug: {
          message: identityError?.message ?? "Lead not found",
          code: identityError?.code ?? null,
          details: identityError?.details ?? null,
        },
      }, 404);
    }

    const accountId = leadIdentity.account_id;
    if (providedAccountId && providedAccountId !== accountId) {
      return json({ error: "account_id does not match lead record" }, 403);
    }

    const nowIso = new Date().toISOString();
    const updatePayload = qualified
      ? {
        status: "qualified",
        approval_status: "approved",
        approved_at: nowIso,
        rejected_at: null,
        approval_reason: null,
        address: address || null,
        city: city || null,
        description: description || null,
        notes: description || null,
      }
      : {
        approval_status: "rejected",
        rejected_at: nowIso,
        approved_at: null,
        approval_reason: "other",
        address: address || null,
        city: city || null,
        description: description || null,
        notes: description || null,
      };

    const { data: leadRow, error: leadError } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", resolvedLeadId)
      .eq("account_id", accountId)
      .select("id, approval_status, status")
      .maybeSingle();

    if (leadError || !leadRow?.id) {
      return json({
        success: false,
        error: "Lead update failed",
        debug: {
          message: leadError?.message ?? "Lead not found",
          code: leadError?.code ?? null,
          details: leadError?.details ?? null,
        },
      }, 404);
    }

    if (qualified || homeowner !== null) {
      const qualificationUpsert: Record<string, unknown> = {
        lead_id: resolvedLeadId,
        account_id: accountId,
      };
      if (qualified) {
        qualificationUpsert.budget_confirmed = true;
        qualificationUpsert.service_area_fit = true;
      }
      if (homeowner !== null) {
        qualificationUpsert.decision_maker_confirmed = homeowner;
      }

      await supabase
        .from("lead_qualifications")
        .upsert(
          qualificationUpsert,
          { onConflict: "lead_id" },
        );
    }

    await supabase.from("interactions").insert({
      lead_id: resolvedLeadId,
      type: "text",
      direction: "outbound",
      summary: qualified ? "Lead automation marked qualified" : "Lead automation marked not qualified",
      body: reason || (qualified
        ? "Qualified by explicit webhook decision."
        : "Not qualified by explicit webhook decision."),
      metadata: {
        source: "lead_automation",
        qualification_source: source,
        retell_chat_id: retellChatId || null,
        qualified,
        reason: reason || null,
        payload_keys: Object.keys(payloadRecord),
        args_keys: Object.keys(argsRecord),
      },
    });

    return json({
      success: true,
      lead_id: leadRow.id,
      approval_status: leadRow.approval_status,
      status: leadRow.status,
      qualified,
    });
  } catch (error) {
    return json({
      success: false,
      error: "Unhandled qualification webhook error",
      debug: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
