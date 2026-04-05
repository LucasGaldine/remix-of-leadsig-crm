export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-leadsig-api-key",
};

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function hashApiKey(apiKey: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateApiKey(
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>,
  apiKey: string,
) {
  const keyHash = await hashApiKey(apiKey);

  const { data: apiKeyRecord, error } = await supabase
    .from("api_keys")
    .select("user_id, account_id, is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !apiKeyRecord || !apiKeyRecord.is_active || !apiKeyRecord.account_id) {
    return { error: "Invalid or inactive API key" as const };
  }

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);

  return {
    userId: apiKeyRecord.user_id,
    accountId: apiKeyRecord.account_id,
  };
}

export async function resolveLeadId(
  supabase: ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>,
  accountId: string,
  payload: Record<string, unknown>,
): Promise<{ leadId?: string; error?: string }> {
  const directLeadId = asString(payload.lead_id) ?? asString(payload.leadId);

  if (directLeadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", directLeadId)
      .eq("account_id", accountId)
      .maybeSingle();

    if (!lead) {
      return { error: "Lead not found for provided lead_id" };
    }

    return { leadId: lead.id };
  }

  const clientLookup = (payload.client ?? payload.client_lookup ?? {}) as Record<string, unknown>;

  const externalSourceId = asString(payload.external_source_id)
    ?? asString(payload.externalSourceId)
    ?? asString(clientLookup.external_source_id)
    ?? asString(clientLookup.externalSourceId);

  const email = asString(payload.email)
    ?? asString(clientLookup.email);

  const phone = asString(payload.phone)
    ?? asString(payload.phone_number)
    ?? asString(clientLookup.phone)
    ?? asString(clientLookup.phone_number);

  if (!externalSourceId && !email && !phone) {
    return { error: "Provide lead_id or a client lookup (external_source_id, email, or phone)" };
  }

  if (externalSourceId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("account_id", accountId)
      .eq("external_source_id", externalSourceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead) {
      return { leadId: lead.id };
    }
  }

  if (email) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("account_id", accountId)
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead) {
      return { leadId: lead.id };
    }
  }

  if (phone) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("account_id", accountId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lead) {
      return { leadId: lead.id };
    }
  }

  return { error: "No matching lead found for the provided client lookup" };
}
