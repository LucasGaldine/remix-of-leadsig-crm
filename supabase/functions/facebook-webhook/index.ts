import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FB_GRAPH_VERSION = "v21.0";
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

interface LeadgenEntry {
  id: string;
  time: number;
  changes: Array<{
    field: string;
    value: {
      leadgen_id: string;
      page_id: string;
      form_id: string;
      created_time: number;
    };
  }>;
}

interface FacebookLeadField {
  name: string;
  values: string[];
}

async function fetchLeadData(
  leadgenId: string,
  pageAccessToken: string
): Promise<{ field_data: FacebookLeadField[] } | null> {
  const url = `${FB_GRAPH_BASE}/${leadgenId}?access_token=${pageAccessToken}&fields=id,created_time,field_data,form_id`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(
      `Failed to fetch lead ${leadgenId}: ${res.status} ${res.statusText}`
    );
    return null;
  }
  return await res.json();
}

function parseFacebookFieldData(
  fieldData: FacebookLeadField[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {
    name: null,
    email: null,
    phone: null,
    city: null,
    state: null,
    address: null,
    service_type: null,
    notes: null,
  };
  const nameParts: string[] = [];
  const extraNotes: string[] = [];

  for (const field of fieldData) {
    const key = (field.name || "").toLowerCase();
    const val = field.values?.[0]?.trim() || "";
    if (!val) continue;

    if (key === "full_name" || key.includes("full name")) {
      result.name = val;
    } else if (key === "first_name" || key.includes("first")) {
      nameParts[0] = val;
    } else if (key === "last_name" || key.includes("last")) {
      nameParts[1] = val;
    } else if (key.includes("email")) {
      result.email = val;
    } else if (key.includes("phone")) {
      result.phone = val;
    } else if (key.includes("city")) {
      result.city = val;
    } else if (key.includes("state") || key.includes("region")) {
      result.state = val;
    } else if (key.includes("address") || key.includes("street")) {
      result.address = val;
    } else if (key.includes("service") || key.includes("type")) {
      result.service_type = val;
    } else {
      extraNotes.push(`${field.name}: ${val}`);
    }
  }

  if (!result.name && nameParts.length > 0) {
    result.name = nameParts.filter(Boolean).join(" ");
  }

  if (extraNotes.length > 0) {
    result.notes = extraNotes.join("; ");
  }

  return result;
}

async function processLeadgenEvent(
  entry: LeadgenEntry,
  supabase: ReturnType<typeof createClient>
) {
  for (const change of entry.changes) {
    if (change.field !== "leadgen") continue;

    const { leadgen_id, page_id } = change.value;

    const { data: connection } = await supabase
      .from("lead_source_connections")
      .select("id, user_id, account_id, settings_json")
      .eq("platform", "facebook")
      .eq("status", "connected")
      .filter("settings_json->>page_id", "eq", page_id)
      .maybeSingle();

    if (!connection) {
      console.error(`No connection found for Facebook page ${page_id}`);
      continue;
    }

    const settings = connection.settings_json as Record<string, string>;
    const pageAccessToken = settings?.page_access_token;
    if (!pageAccessToken) {
      console.error(`No access token for page ${page_id}`);
      continue;
    }

    const leadData = await fetchLeadData(leadgen_id, pageAccessToken);
    if (!leadData?.field_data) {
      console.error(`Could not fetch lead data for ${leadgen_id}`);
      continue;
    }

    const parsed = parseFacebookFieldData(leadData.field_data);

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: parsed.name || "Facebook Lead",
        email: parsed.email || null,
        phone: parsed.phone || null,
        city: parsed.city || null,
        state: parsed.state || null,
        address: parsed.address || null,
        service_type: parsed.service_type || null,
        notes: parsed.notes || null,
        source: "facebook",
        external_source_id: leadgen_id,
        external_payload: leadData,
        status: "new",
        approval_status: "pending",
        created_by: connection.user_id,
        account_id: connection.account_id,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (leadError) {
      console.error(`Failed to create lead from ${leadgen_id}:`, leadError);
      continue;
    }

    if (lead) {
      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "system",
        direction: "na",
        summary: "Lead received from Facebook Lead Ads",
        metadata: {
          source: "facebook",
          leadgen_id,
          page_id,
          form_id: change.value.form_id,
        },
      });
    }

    await supabase
      .from("lead_source_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    console.log(`Facebook lead ${leadgen_id} created as ${lead?.id}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("FACEBOOK_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      console.log("Facebook webhook verified");
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden", {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Facebook webhook received:", JSON.stringify(body));

    if (body.object !== "page") {
      return new Response(JSON.stringify({ error: "Not a page event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entries = (body.entry || []) as LeadgenEntry[];

    EdgeRuntime.waitUntil(
      (async () => {
        for (const entry of entries) {
          try {
            await processLeadgenEvent(entry, supabase);
          } catch (err) {
            console.error("Error processing leadgen entry:", err);
          }
        }
      })()
    );

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("facebook-webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
