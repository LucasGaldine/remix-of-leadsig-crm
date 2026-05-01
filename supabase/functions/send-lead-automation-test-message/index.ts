import { createClient } from "npm:@supabase/supabase-js@2";
import { buildLeadAutomationDynamicVars } from "../_shared/lead-automation-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const HARDCODED_RETELL_AGENT_ID = "agent_84800e79b94377a4f275cf63b6";

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function getConnectedTwilioConfig(rawSettings: unknown): { accountSid: string; authToken: string; fromNumber: string } | null {
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) return null;

  const settings = rawSettings as Record<string, unknown>;
  const automation = settings.job_message_automation;
  if (!automation || typeof automation !== "object" || Array.isArray(automation)) return null;

  const twilio = (automation as Record<string, unknown>).twilio;
  if (!twilio || typeof twilio !== "object" || Array.isArray(twilio)) return null;

  const accountSid = (twilio as Record<string, unknown>).account_sid;
  const authToken = (twilio as Record<string, unknown>).auth_token;
  const fromNumber = (twilio as Record<string, unknown>).from_number;
  if (typeof accountSid !== "string" || typeof authToken !== "string" || typeof fromNumber !== "string") return null;

  const trimmedAccountSid = accountSid.trim();
  const trimmedAuthToken = authToken.trim();
  const normalizedFromNumber = normalizePhone(fromNumber.trim());
  if (!trimmedAccountSid || !trimmedAuthToken || !normalizedFromNumber) return null;

  return {
    accountSid: trimmedAccountSid,
    authToken: trimmedAuthToken,
    fromNumber: normalizedFromNumber,
  };
}

function isLeadMessageAutomationEnabled(rawSettings: unknown): boolean {
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) return false;

  const settings = rawSettings as Record<string, unknown>;
  const leadAutomation = settings.lead_message_automation;
  if (!leadAutomation || typeof leadAutomation !== "object" || Array.isArray(leadAutomation)) return false;

  return (leadAutomation as Record<string, unknown>).enabled === true;
}

function isToolPayloadMessage(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("```")) return true;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const normalized = trimmed.toLowerCase();
    if (normalized.includes("\"waited\"") || normalized.includes("\"delay_ms\"") || normalized.includes("\"tool\"")) {
      return true;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object") return false;
      if (Array.isArray(parsed)) return true;
      const record = parsed as Record<string, unknown>;
      if (record.waited === true || typeof record.delay_ms === "number") return true;
      return Object.keys(record).length > 0;
    } catch {
      return false;
    }
  }

  return !/[A-Za-z]/.test(trimmed);
}

function isAssistantLikeRole(role: unknown): boolean {
  if (typeof role !== "string") return true;
  const normalized = role.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "assistant" || normalized === "agent" || normalized === "ai";
}

async function createRetellChat(params: {
  supabase: ReturnType<typeof createClient>;
  apiKey: string;
  firstName: string;
  companyName: string;
  leadId: string;
  accountId: string;
  to: string;
  from: string;
  accountSettings?: unknown;
}): Promise<{ success: boolean; chatId?: string; error?: string; status?: number; responseBody?: unknown }> {
  const dynamicVars = await buildLeadAutomationDynamicVars({
    supabase: params.supabase,
    accountId: params.accountId,
    firstName: params.firstName,
    companyName: params.companyName,
    accountSettings: params.accountSettings,
  });

  const response = await fetch("https://api.retellai.com/create-chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: HARDCODED_RETELL_AGENT_ID,
      retell_llm_dynamic_variables: dynamicVars,
      metadata: {
        source: "lead_automation_test",
        lead_id: params.leadId,
        account_id: params.accountId,
        to_number: params.to,
        from_number: params.from,
      },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      (typeof result?.message === "string" && result.message)
      || (typeof result?.error === "string" && result.error)
      || (typeof result?.detail === "string" && result.detail)
      || JSON.stringify(result);
    return { success: false, error: `Retell ${response.status}: ${detail}`, status: response.status, responseBody: result };
  }

  const chatId = typeof result?.chat_id === "string" ? result.chat_id : "";
  if (!chatId) {
    return { success: false, error: "Retell returned no chat_id", status: response.status, responseBody: result };
  }

  return { success: true, chatId, responseBody: result };
}

async function createRetellChatCompletion(params: {
  apiKey: string;
  chatId: string;
  content: string;
}): Promise<{ success: boolean; message?: string; error?: string; status?: number; responseBody?: unknown }> {
  const response = await fetch("https://api.retellai.com/create-chat-completion", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      content: params.content,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      (typeof result?.message === "string" && result.message)
      || (typeof result?.error === "string" && result.error)
      || (typeof result?.detail === "string" && result.detail)
      || JSON.stringify(result);
    return { success: false, error: `Retell ${response.status}: ${detail}`, status: response.status, responseBody: result };
  }

  const generatedMessage =
    Array.isArray(result?.messages)
      ? result.messages
        .filter((message) => isAssistantLikeRole(message?.role))
        .map((message) =>
          typeof message?.content === "string" && message.content.trim().length > 0
            ? message.content.trim()
            : "",
        )
        .filter((message) => !isToolPayloadMessage(message))
        .slice(-1)[0]
      : "";

  if (!generatedMessage) {
    return {
      success: true,
      message: "This is a lead automation test message. Please reply with your project details.",
      responseBody: result,
    };
  }

  return { success: true, message: generatedMessage, responseBody: result };
}

async function sendTwilioSms(params: {
  to: string;
  body: string;
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): Promise<{ success: boolean; sid?: string; error?: string; status?: number; responseBody?: unknown }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`;
  const credentials = btoa(`${params.accountSid}:${params.authToken}`);

  const form = new URLSearchParams({
    To: params.to,
    From: params.fromNumber,
    Body: params.body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: (typeof result?.message === "string" && result.message) || `Twilio ${response.status}`,
      status: response.status,
      responseBody: result,
    };
  }

  return { success: true, sid: typeof result?.sid === "string" ? result.sid : undefined, responseBody: result };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const accountId = typeof payload?.account_id === "string" ? payload.account_id.trim() : "";
    const toPhone = normalizePhone(typeof payload?.to === "string" ? payload.to.trim() : "");

    if (!accountId || !toPhone) {
      return new Response(JSON.stringify({
        error: "Missing account_id or destination phone number",
        debug: { stage: "validate_input" },
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!token) {
      return new Response(JSON.stringify({
        error: "Missing authorization token",
        debug: { stage: "extract_auth_token" },
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        debug: {
          stage: "auth_get_user",
          provider_error: userError?.message ?? null,
        },
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({
        error: "You do not have access to this account",
        debug: { stage: "membership_check" },
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, pricing_plan, settings")
      .eq("id", accountId)
      .maybeSingle();

    if (account?.pricing_plan === "free") {
      return new Response(JSON.stringify({
        error: "Auto messaging is not available on the Free plan",
        debug: { stage: "pricing_check", pricing_plan: account.pricing_plan },
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isLeadMessageAutomationEnabled(account?.settings)) {
      return new Response(JSON.stringify({
        error: "Enable lead message automation before sending a lead test.",
        debug: { stage: "lead_automation_enabled_check" },
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectedTwilio = getConnectedTwilioConfig(account?.settings);
    if (!connectedTwilio) {
      return new Response(JSON.stringify({
        error: "Connected Twilio credentials are required for lead message automation.",
        debug: { stage: "twilio_credentials_check" },
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const retellApiKey = Deno.env.get("RETELL_API_KEY")?.trim() || "";
    if (!retellApiKey) {
      return new Response(JSON.stringify({
        error: "RETELL_API_KEY is not configured",
        debug: { stage: "retell_api_key_check" },
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, phone")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(2000);

    const matchedLead = (leads ?? []).find((lead) => normalizePhone((lead.phone || "").trim()) === toPhone);
    if (!matchedLead?.id) {
      return new Response(JSON.stringify({
        success: false,
        error: "No lead found with that phone number in this account. Use a real lead phone number to test conversation memory.",
        debug: { stage: "lead_lookup_by_phone", to_number: toPhone },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = matchedLead.name?.trim().split(/\s+/)[0] || "Test";
    const companyName = account?.company_name?.trim() || "your company";

    const chatResult = await createRetellChat({
      supabase,
      apiKey: retellApiKey,
      firstName,
      companyName,
      leadId: matchedLead.id,
      accountId,
      to: toPhone,
      from: connectedTwilio.fromNumber,
      accountSettings: account?.settings,
    });

    if (!chatResult.success || !chatResult.chatId) {
      return new Response(JSON.stringify({
        success: false,
        error: chatResult.error || "Failed to create Retell chat",
        debug: {
          stage: "retell_create_chat",
          provider: "retell",
          provider_status: chatResult.status ?? null,
          provider_response: chatResult.responseBody ?? null,
          to_number: toPhone,
          agent_id: HARDCODED_RETELL_AGENT_ID,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const completionResult = await createRetellChatCompletion({
      apiKey: retellApiKey,
      chatId: chatResult.chatId,
      content: "Send a short lead automation test message and ask one project follow-up question.",
    });

    if (!completionResult.success || !completionResult.message) {
      return new Response(JSON.stringify({
        success: false,
        error: completionResult.error || "Failed to generate lead test message",
        debug: {
          stage: "retell_create_chat_completion",
          provider: "retell",
          provider_status: completionResult.status ?? null,
          provider_response: completionResult.responseBody ?? null,
          to_number: toPhone,
          chat_id: chatResult.chatId,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twilioResult = await sendTwilioSms({
      to: toPhone,
      body: completionResult.message,
      accountSid: connectedTwilio.accountSid,
      authToken: connectedTwilio.authToken,
      fromNumber: connectedTwilio.fromNumber,
    });

    if (!twilioResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: twilioResult.error || "Failed to send lead test message",
        debug: {
          stage: "twilio_send_message",
          provider: "twilio",
          provider_status: twilioResult.status ?? null,
          provider_response: twilioResult.responseBody ?? null,
          to_number: toPhone,
          from_number: connectedTwilio.fromNumber,
          chat_id: chatResult.chatId,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("interactions").insert({
      lead_id: matchedLead.id,
      type: "text",
      direction: "outbound",
      summary: "Lead automation test outbound message",
      body: completionResult.message,
      metadata: {
        source: "lead_automation_test",
        retell_chat_id: chatResult.chatId,
        twilio_sid: twilioResult.sid ?? null,
        from_number: connectedTwilio.fromNumber,
        to_number: toPhone,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      to: toPhone,
      sid: twilioResult.sid ?? null,
      chat_id: chatResult.chatId,
      message_preview: completionResult.message,
      debug: {
        stage: "twilio_send_message_success",
        provider: "twilio",
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-lead-automation-test-message error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
