import { createClient } from "npm:@supabase/supabase-js@2";

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

async function fetchIncomingPhoneNumberSid(params: {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}): Promise<{ success: boolean; sid?: string; error?: string; status?: number; responseBody?: unknown }> {
  const credentials = btoa(`${params.accountSid}:${params.authToken}`);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(params.phoneNumber)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
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

  const incoming = Array.isArray(result?.incoming_phone_numbers) ? result.incoming_phone_numbers : [];
  const exactMatch = incoming.find((item) => normalizePhone(String(item?.phone_number || "")) === params.phoneNumber);
  if (!exactMatch?.sid) {
    return {
      success: false,
      error: "Phone number not found in Twilio account",
      status: 404,
      responseBody: result,
    };
  }

  return { success: true, sid: exactMatch.sid, responseBody: result };
}

async function configureIncomingWebhook(params: {
  accountSid: string;
  authToken: string;
  phoneNumberSid: string;
  smsUrl: string;
}): Promise<{ success: boolean; error?: string; status?: number; responseBody?: unknown }> {
  const credentials = btoa(`${params.accountSid}:${params.authToken}`);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/IncomingPhoneNumbers/${params.phoneNumberSid}.json`;

  const form = new URLSearchParams({
    SmsUrl: params.smsUrl,
    SmsMethod: "POST",
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

  return { success: true, responseBody: result };
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

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Missing account_id" }), {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
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
      .select("settings")
      .eq("id", accountId)
      .maybeSingle();

    const twilioConfig = getConnectedTwilioConfig(account?.settings);
    if (!twilioConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: "Connected Twilio credentials are required before configuring inbound SMS.",
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/lead-automation-inbound-sms`;

    const sidResult = await fetchIncomingPhoneNumberSid({
      accountSid: twilioConfig.accountSid,
      authToken: twilioConfig.authToken,
      phoneNumber: twilioConfig.fromNumber,
    });

    if (!sidResult.success || !sidResult.sid) {
      return new Response(JSON.stringify({
        success: false,
        error: sidResult.error || "Could not find Twilio phone number",
        debug: {
          stage: "find_phone_number_sid",
          provider_status: sidResult.status ?? null,
          provider_response: sidResult.responseBody ?? null,
          from_number: twilioConfig.fromNumber,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configureResult = await configureIncomingWebhook({
      accountSid: twilioConfig.accountSid,
      authToken: twilioConfig.authToken,
      phoneNumberSid: sidResult.sid,
      smsUrl: webhookUrl,
    });

    if (!configureResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: configureResult.error || "Could not configure Twilio inbound webhook",
        debug: {
          stage: "configure_incoming_phone_number",
          provider_status: configureResult.status ?? null,
          provider_response: configureResult.responseBody ?? null,
          phone_number_sid: sidResult.sid,
          webhook_url: webhookUrl,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      webhook_url: webhookUrl,
      phone_number_sid: sidResult.sid,
      from_number: twilioConfig.fromNumber,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("configure-lead-sms-webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
