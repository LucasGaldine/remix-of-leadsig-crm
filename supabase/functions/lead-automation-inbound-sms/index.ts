import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildLeadAutomationDynamicVars,
  extractQualificationDecisionFromRetellResponse,
} from "../_shared/lead-automation-context.ts";

const HARDCODED_RETELL_AGENT_ID = "agent_84800e79b94377a4f275cf63b6";

type InteractionMetadata = Record<string, unknown>;

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

function emptyTwiml(status = 200): Response {
  return xmlResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", status);
}

function getLeadMessageAutomationEnabled(rawSettings: unknown): boolean {
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) return false;
  const leadAutomation = (rawSettings as Record<string, unknown>).lead_message_automation;
  if (!leadAutomation || typeof leadAutomation !== "object" || Array.isArray(leadAutomation)) return false;
  return (leadAutomation as Record<string, unknown>).enabled === true;
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
        source: "website_sms",
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
      message: "Thanks for the details. We got your message and a team member will follow up shortly.",
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

function getRetellChatIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const chatId = (metadata as InteractionMetadata).retell_chat_id;
  return typeof chatId === "string" && chatId.trim() ? chatId.trim() : null;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return emptyTwiml(200);
  }

  if (req.method !== "POST") {
    return emptyTwiml(405);
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
      return emptyTwiml(200);
    }

    const form = await req.formData();
    const from = normalizePhone(String(form.get("From") || "").trim());
    const to = normalizePhone(String(form.get("To") || "").trim());
    const body = String(form.get("Body") || "").trim();
    const inboundSid = String(form.get("MessageSid") || "").trim();

    if (!from || !to || !body) {
      return emptyTwiml(200);
    }

    const lowerBody = body.toLowerCase();
    if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "help", "start", "unstop"].includes(lowerBody)) {
      return emptyTwiml(200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: accounts, error: accountError } = await supabase
      .from("accounts")
      .select("id, company_name, pricing_plan, settings");

    if (accountError || !accounts?.length) {
      console.error("lead-automation-inbound-sms: failed to load accounts", accountError);
      return emptyTwiml(200);
    }

    const matchingAccount = accounts.find((account) => {
      const twilio = getConnectedTwilioConfig(account.settings);
      return twilio?.fromNumber === to;
    });

    if (!matchingAccount) {
      console.warn("lead-automation-inbound-sms: no account found for destination number", { to });
      return emptyTwiml(200);
    }

    if (matchingAccount.pricing_plan === "free" || !getLeadMessageAutomationEnabled(matchingAccount.settings)) {
      return emptyTwiml(200);
    }

    const twilioConfig = getConnectedTwilioConfig(matchingAccount.settings);
    if (!twilioConfig) {
      console.warn("lead-automation-inbound-sms: missing twilio config", { account_id: matchingAccount.id });
      return emptyTwiml(200);
    }

    const retellApiKey = Deno.env.get("RETELL_API_KEY")?.trim() || "";
    if (!retellApiKey) {
      console.error("lead-automation-inbound-sms: RETELL_API_KEY missing");
      return emptyTwiml(200);
    }

    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, phone")
      .eq("account_id", matchingAccount.id)
      .order("created_at", { ascending: false })
      .limit(200);

    const matchedLead = (leads ?? []).find((lead) => normalizePhone((lead.phone || "").trim()) === from);
    if (!matchedLead?.id) {
      console.warn("lead-automation-inbound-sms: no lead match for sender", {
        account_id: matchingAccount.id,
        from,
      });
      return emptyTwiml(200);
    }

    const firstName = matchedLead.name?.trim().split(/\s+/)[0] || "there";
    const companyName = matchingAccount.company_name?.trim() || "our team";

    const { data: interactions } = await supabase
      .from("interactions")
      .select("metadata")
      .eq("lead_id", matchedLead.id)
      .order("created_at", { ascending: false })
      .limit(50);

    let retellChatId =
      (interactions ?? [])
        .map((interaction) => getRetellChatIdFromMetadata(interaction.metadata))
        .find((chatId): chatId is string => !!chatId)
      || null;

    if (!retellChatId) {
      const chatResult = await createRetellChat({
        supabase,
        apiKey: retellApiKey,
        firstName,
        companyName,
        leadId: matchedLead.id,
        accountId: matchingAccount.id,
        to: from,
        from: twilioConfig.fromNumber,
        accountSettings: matchingAccount.settings,
      });

      if (!chatResult.success || !chatResult.chatId) {
        console.error("lead-automation-inbound-sms: retell create-chat failed", {
          error: chatResult.error,
          status: chatResult.status,
          response: chatResult.responseBody,
          account_id: matchingAccount.id,
          lead_id: matchedLead.id,
          from,
        });
        return emptyTwiml(200);
      }

      retellChatId = chatResult.chatId;
    }

    await supabase.from("interactions").insert({
      lead_id: matchedLead.id,
      type: "text",
      direction: "inbound",
      summary: "Lead inbound reply",
      body,
      metadata: {
        source: "lead_automation",
        retell_chat_id: retellChatId,
        twilio_sid: inboundSid || null,
        from_number: from,
        to_number: to,
      },
    });

    const completionResult = await createRetellChatCompletion({
      apiKey: retellApiKey,
      chatId: retellChatId,
      content: body,
    });

    if (!completionResult.success || !completionResult.message) {
      console.error("lead-automation-inbound-sms: retell create-chat-completion failed", {
        error: completionResult.error,
        status: completionResult.status,
        response: completionResult.responseBody,
        account_id: matchingAccount.id,
        lead_id: matchedLead.id,
        chat_id: retellChatId,
      });
      return emptyTwiml(200);
    }

    const qualificationDecision = extractQualificationDecisionFromRetellResponse(completionResult.responseBody);
    if (qualificationDecision.qualified === true) {
      await supabase
        .from("leads")
        .update({
          status: "qualified",
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          rejected_at: null,
          approval_reason: null,
        })
        .eq("approval_status", "pending")
        .eq("id", matchedLead.id)
        .eq("account_id", matchingAccount.id);
    } else if (qualificationDecision.qualified === false) {
      await supabase
        .from("leads")
        .update({
          approval_status: "rejected",
          approval_reason: "other",
          rejected_at: new Date().toISOString(),
          approved_at: null,
        })
        .eq("approval_status", "pending")
        .eq("id", matchedLead.id)
        .eq("account_id", matchingAccount.id);
    }

    const sent = await sendTwilioSms({
      to: from,
      body: completionResult.message,
      accountSid: twilioConfig.accountSid,
      authToken: twilioConfig.authToken,
      fromNumber: twilioConfig.fromNumber,
    });

    if (!sent.success) {
      console.error("lead-automation-inbound-sms: twilio send failed", {
        error: sent.error,
        status: sent.status,
        response: sent.responseBody,
        account_id: matchingAccount.id,
        lead_id: matchedLead.id,
        to: from,
        from: twilioConfig.fromNumber,
        chat_id: retellChatId,
      });
      return emptyTwiml(200);
    }

    await supabase.from("interactions").insert({
      lead_id: matchedLead.id,
      type: "text",
      direction: "outbound",
      summary: "Lead automation outbound reply",
      body: completionResult.message,
      metadata: {
        source: "lead_automation",
        retell_chat_id: retellChatId,
        twilio_sid: sent.sid ?? null,
        from_number: twilioConfig.fromNumber,
        to_number: from,
        qualification_decision: qualificationDecision.qualified,
        qualification_reason: qualificationDecision.reason ?? null,
      },
    });

    if (qualificationDecision.qualified !== null) {
      await supabase.from("interactions").insert({
        lead_id: matchedLead.id,
        type: "text",
        direction: "outbound",
        summary: qualificationDecision.qualified ? "Lead automation marked qualified" : "Lead automation marked not qualified",
        body: qualificationDecision.reason ?? "Qualification decision recorded from agent response.",
        metadata: {
          source: "lead_automation",
          retell_chat_id: retellChatId,
          qualified: qualificationDecision.qualified,
          reason: qualificationDecision.reason ?? null,
        },
      });
    }

    return emptyTwiml(200);
  } catch (error) {
    console.error("lead-automation-inbound-sms: unexpected error", error);
    return emptyTwiml(200);
  }
});
