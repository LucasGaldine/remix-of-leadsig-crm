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

interface ParsedLead {
  full_name?: string;
  email?: string;
  phone_number?: string;
  budget?: number;
  service_type?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
}

const RELEVANCE_AI_STUDIO_ID = "d50e7c9d-7933-47c5-b284-9295b3faf020";
const RELEVANCE_AI_PROJECT_ID = "a8f61433-8567-40b3-a274-8c65d6d9a062";

async function parseLeadWithAI(rawPayload: unknown): Promise<ParsedLead> {
  const apiKey = Deno.env.get("RELEVANCE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("RELEVANCE_AI_API_KEY not configured");
  }

  const endpoint = `https://api-bcbe5a.stack.tryrelevance.com/latest/studios/${RELEVANCE_AI_STUDIO_ID}/trigger_webhook?project=${RELEVANCE_AI_PROJECT_ID}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify({ lead_data: rawPayload }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.answer) {
      try {
        return JSON.parse(result.answer);
      } catch {
        throw new Error("AI returned invalid JSON format");
      }
    }

    return result.output || result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Relevance AI API timeout after 45 seconds");
    }
    throw error;
  }
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

    let leadName: string | null = null;
    let leadEmail: string | null = null;
    let leadPhone: string | null = null;
    let leadCity: string | null = null;
    let leadState: string | null = null;
    let leadAddress: string | null = null;
    let leadServiceType: string | null = null;
    let leadNotes: string | null = null;
    let leadBudget: number | null = null;
    let parsingMethod = "manual";

    try {
      const aiParsed = await parseLeadWithAI(leadData);
      leadName = aiParsed.full_name || null;
      leadEmail = aiParsed.email || null;
      leadPhone = aiParsed.phone_number || null;
      leadCity = aiParsed.city || null;
      leadState = aiParsed.state || null;
      leadAddress = aiParsed.address || null;
      leadServiceType = aiParsed.service_type || null;
      leadNotes = aiParsed.notes || null;
      leadBudget = aiParsed.budget || null;
      parsingMethod = "ai";
    } catch {
      const fallback = parseFacebookFieldData(leadData.field_data);
      leadName = fallback.name;
      leadEmail = fallback.email;
      leadPhone = fallback.phone;
      leadCity = fallback.city;
      leadState = fallback.state;
      leadAddress = fallback.address;
      leadServiceType = fallback.service_type;
      leadNotes = fallback.notes;
      parsingMethod = "manual";
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: leadName || "Facebook Lead",
        email: leadEmail,
        phone: leadPhone,
        city: leadCity,
        state: leadState,
        address: leadAddress,
        service_type: leadServiceType,
        estimated_value: leadBudget,
        notes: leadNotes,
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
          parsing_method: parsingMethod,
        },
      });
    }

    await supabase
      .from("lead_source_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);
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
