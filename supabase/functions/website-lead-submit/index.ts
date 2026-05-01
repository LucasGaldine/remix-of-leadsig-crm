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

function buildWebsiteFallbackMessage(firstName: string, companyName: string): string {
  return `Hey ${firstName}, we received your request for a quote with ${companyName}. What kind of project are you looking to get done?`;
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
  try {
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
          source: "website",
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
  } catch (error) {
    return { success: false, error: `Retell network error: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

async function createRetellChatCompletion(params: {
  apiKey: string;
  chatId: string;
  content: string;
}): Promise<{ success: boolean; message?: string; error?: string; status?: number; responseBody?: unknown }> {
  try {
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
        message: "Thanks for reaching out. We got your request and will text you shortly with next steps.",
        responseBody: result,
      };
    }

    return { success: true, message: generatedMessage, responseBody: result };
  } catch (error) {
    return { success: false, error: `Retell network error: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

async function sendTwilioSms(params: {
  to: string;
  body: string;
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): Promise<{ success: boolean; sid?: string; error?: string; status?: number; responseBody?: unknown }> {
  try {
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
  } catch (error) {
    return { success: false, error: `Twilio network error: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { account_id, name, email, phone, service_type, notes } = await req.json();

    if (!account_id || !name?.trim()) {
      return json({ error: "account_id and name are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: memberRows, error: memberError } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", account_id)
      .eq("is_active", true)
      .limit(1);

    if (memberError) {
      return json({
        success: false,
        error: "Failed to load account member for lead ownership",
        debug: {
          stage: "load_account_member",
          db_error: memberError.message,
          db_code: memberError.code ?? null,
          db_details: memberError.details ?? null,
        },
      }, 200);
    }

    const member = memberRows?.[0];
    if (!member?.user_id) {
      return json({ error: "Account not found" }, 404);
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, pricing_plan, settings")
      .eq("id", account_id)
      .maybeSingle();

    if (!account) {
      return json({ error: "Account not found" }, 404);
    }

    const { data: createdLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        account_id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        service_type: service_type || null,
        notes: notes?.trim() || null,
        source: "website",
        created_by: member.user_id,
        approval_status: "pending",
        submitted_at: new Date().toISOString(),
        approved_at: null,
        rejected_at: null,
      })
      .select("id")
      .maybeSingle();

    if (leadError || !createdLead?.id) {
      return json({
        success: false,
        error: "Failed to create lead",
        debug: {
          stage: "insert_lead",
          db_error: leadError?.message ?? "No row returned from insert",
          db_code: leadError?.code ?? null,
          db_details: leadError?.details ?? null,
          db_hint: leadError?.hint ?? null,
        },
      }, 200);
    }

    const shouldSendLeadAutoText = account.pricing_plan !== "free" && isLeadMessageAutomationEnabled(account.settings);
    const toPhone = normalizePhone(phone?.trim() || "");
    const connectedTwilio = getConnectedTwilioConfig(account.settings);
    const retellApiKey = Deno.env.get("RETELL_API_KEY")?.trim() || "";

    if (shouldSendLeadAutoText && toPhone && connectedTwilio && createdLead?.id) {
      try {
        const firstName = name.trim().split(/\s+/)[0] || "there";
        const companyName = account.company_name?.trim() || "our team";
        let messageToSend = buildWebsiteFallbackMessage(firstName, companyName);
        let retellChatId: string | null = null;
        let usedRetellMessage = false;

        if (retellApiKey) {
          const chatResult = await createRetellChat({
            supabase,
            apiKey: retellApiKey,
            firstName,
            companyName,
            leadId: createdLead.id,
            accountId: account_id,
            to: toPhone,
            from: connectedTwilio.fromNumber,
            accountSettings: account.settings,
          });

          if (!chatResult.success || !chatResult.chatId) {
            console.error("website-lead-submit: retell create-chat failed, using fallback message", {
              error: chatResult.error,
              status: chatResult.status,
              response: chatResult.responseBody,
              lead_id: createdLead.id,
              account_id,
            });
          } else {
            retellChatId = chatResult.chatId;
            const completionResult = await createRetellChatCompletion({
              apiKey: retellApiKey,
              chatId: chatResult.chatId,
              content: "A new website lead was just submitted. Send the first SMS to greet them and ask one brief question about their project.",
            });

            if (!completionResult.success || !completionResult.message) {
              console.error("website-lead-submit: retell create-chat-completion failed, using fallback message", {
                error: completionResult.error,
                status: completionResult.status,
                response: completionResult.responseBody,
                lead_id: createdLead.id,
                account_id,
                chat_id: chatResult.chatId,
              });
            } else {
              messageToSend = completionResult.message;
              usedRetellMessage = true;
            }
          }
        }

        const twilioResult = await sendTwilioSms({
          to: toPhone,
          body: messageToSend,
          accountSid: connectedTwilio.accountSid,
          authToken: connectedTwilio.authToken,
          fromNumber: connectedTwilio.fromNumber,
        });

        if (!twilioResult.success) {
          console.error("website-lead-submit: twilio send failed", {
            error: twilioResult.error,
            status: twilioResult.status,
            response: twilioResult.responseBody,
            lead_id: createdLead.id,
            account_id,
            chat_id: retellChatId,
          });
        } else {
          await supabase.from("interactions").insert({
            lead_id: createdLead.id,
            type: "text",
            direction: "outbound",
            summary: "Lead automation outbound message",
            body: messageToSend,
            metadata: {
              source: "lead_automation",
              retell_chat_id: retellChatId,
              twilio_sid: twilioResult.sid ?? null,
              from_number: connectedTwilio.fromNumber,
              to_number: toPhone,
              generated_by: usedRetellMessage ? "retell" : "fallback_template",
            },
          });
        }
      } catch (automationError) {
        console.error("website-lead-submit: automation block failed without blocking lead creation", {
          error: automationError instanceof Error ? automationError.message : String(automationError),
          lead_id: createdLead.id,
          account_id,
        });
      }
    }

    return json({ success: true });
  } catch (err) {
    console.error("website-lead-submit error:", err);
    return json({
      success: false,
      error: "Unhandled website lead submit error",
      debug: {
        stage: "unhandled_exception",
        message: err instanceof Error ? err.message : String(err),
      },
    }, 200);
  }
});
