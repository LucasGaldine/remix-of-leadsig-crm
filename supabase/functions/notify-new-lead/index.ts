import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyNewLeadPayload {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadEmail?: string;
  source: string;
  serviceType?: string;
  userId: string;
}

Deno.serve(async (req) => {
  console.log("notify-new-lead: Request received", req.method);

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
      console.error("notify-new-lead: Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const isValidInternalKey = internalKey && token === internalKey;
    const isValidServiceKey = serviceRoleKey && token === serviceRoleKey;

    if (!isValidInternalKey && !isValidServiceKey) {
      console.error("notify-new-lead: Invalid authorization token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("notify-new-lead: RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotifyNewLeadPayload = await req.json();
    console.log("notify-new-lead: Processing notification for lead", payload.leadId);

    // Get the user's email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", payload.userId)
      .single();

    if (profileError || !profile?.email) {
      console.error("notify-new-lead: Could not find user email", profileError);
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the email content
    const leadDetails = [
      `<strong>Name:</strong> ${payload.leadName}`,
      payload.leadPhone ? `<strong>Phone:</strong> ${payload.leadPhone}` : null,
      payload.leadEmail ? `<strong>Email:</strong> ${payload.leadEmail}` : null,
      payload.serviceType ? `<strong>Service Type:</strong> ${payload.serviceType}` : null,
      `<strong>Source:</strong> ${payload.source}`,
    ].filter(Boolean).join("<br>");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Lead Awaiting Approval</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin-top: 0;">Hi ${profile.full_name || 'there'},</p>
            
            <p>A new lead has arrived and is waiting for your approval:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              ${leadDetails}
            </div>
            
            <p>Log in to your LeadSig dashboard to review and approve or reject this lead.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d;">
              <p style="margin: 0;">This notification was sent because a new lead was submitted via API.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send the email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "LeadSig <onboarding@resend.dev>",
      to: [profile.email],
      subject: `🔔 New Lead: ${payload.leadName} - Awaiting Approval`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("notify-new-lead: Failed to send email", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("notify-new-lead: Email sent successfully", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notify-new-lead: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
