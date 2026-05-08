import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const DEFAULT_GHL_LOCATION_ID = "KD9hwjh6voVmJQKyVHU1";

type GhlSyncPayload = {
  name?: string;
  email?: string;
  business?: string;
  phone?: string;
  monthlyLeads?: string;
  currentTracking?: string;
  heardAbout?: string;
  membership_status?: string;
  membership_source?: string;
};

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeContactPayload(payload: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...payload };
  delete next.locationId;
  for (const key of Object.keys(next)) {
    if (next[key] === undefined || next[key] === null || next[key] === "") {
      delete next[key];
    }
  }
  return next;
}

function normalizedMembershipStatus(status: unknown): string | null {
  const normalized = safeTrim(status).toLowerCase();
  if (!normalized) return null;
  if (normalized === "trialing" || normalized === "active") return "active";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  if (normalized === "past_due") return "past_due";
  if (normalized === "grace") return "grace";
  return "inactive";
}

function membershipTags(status: string): string[] {
  const tags = new Set<string>(["leadsig", "elo_membership"]);
  tags.add(`elo_membership_${status}`);
  if (status === "active" || status === "grace") {
    tags.add("elo_membership_active_like");
  } else {
    tags.add("elo_membership_not_active");
  }
  return Array.from(tags);
}

async function ghlFetch(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: GHL_VERSION,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GHL API ${path} failed [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data as Record<string, unknown>;
}

async function upsertGhlContact(
  token: string,
  payload: Record<string, unknown>,
  locationId: string,
) {
  const withoutLocation = sanitizeContactPayload(payload);
  try {
    return await ghlFetch("/contacts/upsert", token, {
      method: "POST",
      body: JSON.stringify(withoutLocation),
    });
  } catch (error) {
    const message = serializeError(error).toLowerCase();
    if (!message.includes("does not have access to this location")) {
      throw error;
    }

    const withLocation = { ...withoutLocation, locationId };
    return await ghlFetch("/contacts/upsert", token, {
      method: "POST",
      body: JSON.stringify(withLocation),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = safeTrim(Deno.env.get("GHL_LOCATION_ID")) || DEFAULT_GHL_LOCATION_ID;
    if (!ghlApiKey) {
      throw new Error("GHL_API_KEY is not configured");
    }

    const payload = (await req.json()) as GhlSyncPayload;
    const membershipStatus = normalizedMembershipStatus(payload.membership_status);

    const fullName = safeTrim(payload.name) || "ELO Member";
    const business = safeTrim(payload.business) || "ELO Membership";
    const phone = safeTrim(payload.phone);
    const email = safeTrim(payload.email);

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "email or phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || "ELO";
    const lastName = nameParts.slice(1).join(" ") || "Member";

    if (membershipStatus) {
      const membershipPayload = {
        locationId: ghlLocationId,
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        companyName: business,
        source: "LeadSig Membership",
        tags: membershipTags(membershipStatus),
      };
      const contactRes = await upsertGhlContact(ghlApiKey, membershipPayload, ghlLocationId);

      return new Response(
        JSON.stringify({
          success: true,
          mode: "membership_status_sync",
          membership_status: membershipStatus,
          membership_source: payload.membership_source || "stripe_webhook",
          contactId: (contactRes as { contact?: { id?: string } }).contact?.id || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!fullName || !business || !phone) {
      return new Response(
        JSON.stringify({ error: "name, business, and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contactPayload = {
      locationId: ghlLocationId,
      firstName,
      lastName,
      email: email || undefined,
      phone,
      companyName: business,
      source: "LeadSig Beta Application",
      tags: ["beta-applicant", "leadsig"],
      customFields: [
        ...(payload.monthlyLeads ? [{ key: "contact.monthly_leads", field_value: payload.monthlyLeads }] : []),
        ...(payload.currentTracking ? [{ key: "contact.current_tracking", field_value: payload.currentTracking }] : []),
        ...(payload.heardAbout ? [{ key: "contact.heard_about", field_value: payload.heardAbout }] : []),
      ],
    };
    const contactRes = await upsertGhlContact(ghlApiKey, contactPayload, ghlLocationId);

    const contactId = (contactRes as { contact?: { id?: string } }).contact?.id;
    if (!contactId) {
      throw new Error("Failed to get contact ID from upsert response");
    }

    let opportunityId: string | null = null;
    try {
      const pipelinesRes = await ghlFetch(`/opportunities/pipelines?locationId=${ghlLocationId}`, ghlApiKey);
      const pipelines = ((pipelinesRes as { pipelines?: Array<Record<string, unknown>> }).pipelines || []);
      const betaPipeline = pipelines.find((pipeline) =>
        String(pipeline.name || "").toLowerCase().includes("beta")
      ) || pipelines[0];

      if (betaPipeline) {
        const pipelineId = String(betaPipeline.id || "");
        const locationId = safeTrim(betaPipeline.locationId) || ghlLocationId;
        const stages = Array.isArray(betaPipeline.stages) ? betaPipeline.stages : [];
        const firstStage = stages[0] as Record<string, unknown> | undefined;
        const pipelineStageId = safeTrim(firstStage?.id);

        const opportunityRes = await ghlFetch("/opportunities/", ghlApiKey, {
          method: "POST",
          body: JSON.stringify({
            pipelineId,
            locationId,
            name: `Beta Application — ${business}`,
            pipelineStageId: pipelineStageId || undefined,
            status: "open",
            contactId,
            source: "LeadSig Website",
            monetaryValue: 499,
          }),
        });

        opportunityId = (opportunityRes as { opportunity?: { id?: string } }).opportunity?.id || null;
      }
    } catch (error) {
      console.error("Opportunity creation failed (non-blocking):", serializeError(error));
    }

    let taskId: string | null = null;
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      const taskRes = await ghlFetch(`/contacts/${contactId}/tasks`, ghlApiKey, {
        method: "POST",
        body: JSON.stringify({
          title: `Beta onboarding — ${business}`,
          body:
            `New beta applicant: ${fullName} from ${business}. `
            + `Email: ${email || "N/A"}. Phone: ${phone}. `
            + `Monthly leads: ${payload.monthlyLeads || "N/A"}. `
            + `Current tracking: ${payload.currentTracking || "N/A"}. `
            + `Source: ${payload.heardAbout || "N/A"}.`,
          dueDate: dueDate.toISOString(),
          completed: false,
        }),
      });

      taskId = (taskRes as { task?: { id?: string } }).task?.id || null;
    } catch (error) {
      console.error("Task creation failed (non-blocking):", serializeError(error));
    }

    try {
      await ghlFetch(`/contacts/${contactId}/notes`, ghlApiKey, {
        method: "POST",
        body: JSON.stringify({
          body:
            `NEW BETA SIGN-UP\n\nName: ${fullName}\nEmail: ${email || "N/A"}\nBusiness: ${business}\n`
            + `Phone: ${phone}\nMonthly Leads: ${payload.monthlyLeads || "N/A"}\n`
            + `Current Tracking: ${payload.currentTracking || "N/A"}\nHeard About Us: ${payload.heardAbout || "N/A"}\n`,
        }),
      });
    } catch (error) {
      console.error("Note creation failed (non-blocking):", serializeError(error));
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "beta_signup_sync",
        contactId,
        opportunityId,
        taskId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("GHL sync error:", serializeError(error));
    return new Response(
      JSON.stringify({ success: false, error: serializeError(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
