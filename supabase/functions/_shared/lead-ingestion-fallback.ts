type LeadStatusPatch = {
  status: string;
  approval_status?: string | null;
  approved_at: string | null;
  qualified_at?: string | null;
  submitted_at?: string | null;
};

interface ParsedLeadFallback {
  full_name?: string;
  email?: string;
  phone_number?: string;
  notes?: string;
}

export function buildFallbackLeadInsertValues(params: {
  leadData: ParsedLeadFallback | null;
  source: string;
  rawPayload: Record<string, unknown>;
  leadStatus: LeadStatusPatch;
  userId: string;
  accountId: string;
}) {
  const { leadData, source, rawPayload, leadStatus, userId, accountId } = params;
  return {
    name: leadData?.full_name || "Needs Review",
    phone: leadData?.phone_number || null,
    email: leadData?.email || null,
    source,
    external_payload: rawPayload,
    notes: leadData?.notes || "Could not fully parse lead data. Please review raw payload.",
    ...leadStatus,
    created_by: userId,
    account_id: accountId,
  };
}

export function buildFallbackInteractionPayload(params: {
  leadId: string;
  autoQualify: boolean;
  source: string;
  directParsed: boolean;
  aiFallbackReason: "timeout" | "error" | null;
}) {
  const { leadId, autoQualify, source, directParsed, aiFallbackReason } = params;
  const timedOut = aiFallbackReason === "timeout";

  const summary = timedOut
    ? autoQualify
      ? "Lead created after Auto-Qualify endpoint timeout and auto-qualified by integration automation"
      : "Lead created after Auto-Qualify endpoint timeout - needs review"
    : autoQualify
      ? "Lead created with incomplete data and auto-qualified by integration automation"
      : "Lead created with incomplete data - needs review";

  return {
    lead_id: leadId,
    type: "system",
    direction: "na",
    summary,
    metadata: {
      source,
      parsing_method: directParsed ? "direct" : timedOut ? "timeout_fallback" : "failed",
      ai_fallback_reason: aiFallbackReason,
      auto_qualify_endpoint_timeout: timedOut,
    },
  };
}
