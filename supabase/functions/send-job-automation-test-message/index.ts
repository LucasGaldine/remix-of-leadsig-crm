import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateMessagingPolicy, recordMessagingOutcome } from "../_shared/messaging-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function shouldUseDefaultNumber(rawSettings: unknown): boolean {
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) return true;
  const settings = rawSettings as Record<string, unknown>;
  const automation = settings.job_message_automation;
  if (!automation || typeof automation !== "object" || Array.isArray(automation)) return true;

  const useDefault = (automation as Record<string, unknown>).use_default_number;
  return typeof useDefault === "boolean" ? useDefault : true;
}

function getFirstEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function getDefaultTwilioConfig(): { accountSid: string; authToken: string; fromNumber: string } | null {
  const accountSid = getFirstEnvValue(["TWILIO_ACCOUNT_SID", "LEADSIG_TWILIO_ACCOUNT_SID", "DEFAULT_TWILIO_ACCOUNT_SID"]);
  const authToken = getFirstEnvValue(["TWILIO_AUTH_TOKEN", "LEADSIG_TWILIO_AUTH_TOKEN", "DEFAULT_TWILIO_AUTH_TOKEN"]);
  const fromNumber = normalizePhone(getFirstEnvValue(["TWILIO_FROM_NUMBER", "LEADSIG_TWILIO_FROM_NUMBER", "DEFAULT_TWILIO_FROM_NUMBER"]));

  if (!accountSid || !authToken || !fromNumber) return null;

  return { accountSid, authToken, fromNumber };
}

async function sendTwilioSms(params: {
  to: string;
  body: string;
  accountSid: string;
  authToken: string;
  fromNumber: string;
}): Promise<{ success: boolean; sid?: string; error?: string }> {
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

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result?.message || `Twilio ${response.status}` };
  }

  return { success: true, sid: result.sid };
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
    const testMessage = typeof payload?.message === "string" && payload.message.trim().length > 0
      ? payload.message.trim()
      : "LeadSig auto messaging test from your active sender number.";

    if (!accountId || !toPhone) {
      return new Response(JSON.stringify({ error: "Missing account_id or destination phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "You do not have access to this account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("pricing_plan, settings")
      .eq("id", accountId)
      .maybeSingle();

    if (account?.pricing_plan === "free") {
      return new Response(JSON.stringify({ error: "Auto messaging is not available on the Free plan" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const useDefaultNumber = shouldUseDefaultNumber(account?.settings);
    const connectedTwilio = getConnectedTwilioConfig(account?.settings);
    const defaultTwilio = getDefaultTwilioConfig();
    const twilioConfig = useDefaultNumber ? defaultTwilio : (connectedTwilio ?? defaultTwilio);
    if (!twilioConfig) {
      const debug = {
        use_default_number: useDefaultNumber,
        has_connected_twilio: Boolean(connectedTwilio),
        has_default_twilio_env: Boolean(getDefaultTwilioConfig()),
      };
      return new Response(JSON.stringify({
        error: "No messaging sender is configured for auto messaging text delivery",
        details: "Configure an outside Twilio number in settings or set platform TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
        debug,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smsPolicy = await evaluateMessagingPolicy(supabase, {
      accountId,
      to: toPhone,
      body: testMessage,
      channel: "sms",
      templateId: "job_automation_test",
      consentStatus: "opted_in",
      consentSource: "manual_test",
    });

    if (!smsPolicy.allow) {
      return new Response(JSON.stringify({
        error: `Blocked by messaging policy: ${smsPolicy.reason}`,
        decision: smsPolicy.decision,
        risk_score: smsPolicy.riskScore,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smsResult = await sendTwilioSms({
      to: toPhone,
      body: testMessage,
      accountSid: twilioConfig.accountSid,
      authToken: twilioConfig.authToken,
      fromNumber: twilioConfig.fromNumber,
    });

    if (!smsResult.success) {
      await recordMessagingOutcome(supabase, {
        accountId,
        channel: "sms",
        recipient: toPhone,
        success: false,
        errorMessage: smsResult.error || null,
      });
      return new Response(JSON.stringify({ error: smsResult.error || "Failed to send test message" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await recordMessagingOutcome(supabase, {
      accountId,
      channel: "sms",
      recipient: toPhone,
      success: true,
    });

    return new Response(JSON.stringify({ success: true, sid: smsResult.sid, to: toPhone }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-job-automation-test-message error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
