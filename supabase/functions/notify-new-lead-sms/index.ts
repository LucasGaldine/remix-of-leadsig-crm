import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsNotificationPayload {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadEmail?: string;
  source: string;
  serviceType?: string;
}

serve(async (req) => {
  console.log("notify-new-lead-sms: Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal service authentication
    // Accept either the internal service key or the Supabase service role key
    const internalKey = Deno.env.get("INTERNAL_SERVICE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("notify-new-lead-sms: Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isValidInternalKey = internalKey && token === internalKey;
    const isValidServiceKey = serviceRoleKey && token === serviceRoleKey;

    if (!isValidInternalKey && !isValidServiceKey) {
      console.error("notify-new-lead-sms: Invalid authorization token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const notificationPhoneNumber = Deno.env.get("NOTIFICATION_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber || !notificationPhoneNumber) {
      console.error("notify-new-lead-sms: Missing Twilio configuration");
      return new Response(
        JSON.stringify({ error: "Twilio configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: SmsNotificationPayload = await req.json();
    console.log("notify-new-lead-sms: Payload received", JSON.stringify(payload));

    // Build SMS message
    const contactInfo = payload.leadPhone || payload.leadEmail || "No contact info";
    const serviceInfo = payload.serviceType ? ` for ${payload.serviceType}` : "";
    
    const smsBody = `🚨 New Lead Alert!\n\n` +
      `Name: ${payload.leadName}\n` +
      `Contact: ${contactInfo}\n` +
      `Source: ${payload.source}${serviceInfo}\n\n` +
      `Login to LeadSig to review and approve.`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append("To", notificationPhoneNumber);
    formData.append("From", twilioPhoneNumber);
    formData.append("Body", smsBody);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("notify-new-lead-sms: Twilio API error", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("notify-new-lead-sms: SMS sent successfully", result.sid);

    return new Response(
      JSON.stringify({ success: true, messageSid: result.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notify-new-lead-sms: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
