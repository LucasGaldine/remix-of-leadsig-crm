import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MembershipStatus = "free" | "premium";

type GhlContact = {
  email?: string;
  tags?: Array<string | { name?: string | null }>;
};

const PAID_COMMUNITY_TAG = "optin_paid_community";

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

const extractTags = (contact: GhlContact): string[] => {
  if (!Array.isArray(contact.tags)) return [];

  return contact.tags
    .map((tag) => {
      if (typeof tag === "string") return tag;
      if (tag && typeof tag === "object" && typeof tag.name === "string") return tag.name;
      return null;
    })
    .filter((tag): tag is string => Boolean(tag && tag.trim()))
    .map((tag) => normalizeTag(tag));
};

const hasPaidCommunityTag = (contact: GhlContact): boolean =>
  extractTags(contact).includes(PAID_COMMUNITY_TAG);

const parseContacts = (payload: unknown): GhlContact[] => {
  if (!payload || typeof payload !== "object") return [];

  const asRecord = payload as Record<string, unknown>;
  const candidates = [
    asRecord.contacts,
    asRecord.data,
    asRecord.results,
    asRecord.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as GhlContact[];
    }
  }

  return [];
};

const fetchContactsByEmail = async (params: {
  apiBaseUrl: string;
  apiKey: string;
  locationId: string;
  email: string;
}): Promise<GhlContact[]> => {
  const { apiBaseUrl, apiKey, locationId, email } = params;
  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-07-28",
    Accept: "application/json",
  };

  const searchAttempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${apiBaseUrl}/contacts/search`,
      init: {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          page: 1,
          pageLimit: 20,
          filters: [{ field: "email", operator: "eq", value: email }],
        }),
      },
    },
    {
      url: `${apiBaseUrl}/contacts/search`,
      init: {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          query: email,
          page: 1,
          pageLimit: 20,
        }),
      },
    },
    {
      url: `${apiBaseUrl}/contacts/?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(email)}`,
      init: {
        method: "GET",
        headers: authHeaders,
      },
    },
  ];

  let lastErrorBody = "";

  for (const attempt of searchAttempts) {
    const response = await fetch(attempt.url, attempt.init);
    if (!response.ok) {
      lastErrorBody = await response.text();
      continue;
    }

    const payload = (await response.json()) as unknown;
    const contacts = parseContacts(payload);
    if (contacts.length > 0) {
      return contacts;
    }
  }

  if (lastErrorBody) {
    throw new Error(`GoHighLevel contact lookup failed: ${lastErrorBody}`);
  }

  return [];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const ghlApiBaseUrl = (Deno.env.get("GHL_API_BASE_URL") || "https://services.leadconnectorhq.com").replace(/\/+$/, "");

    if (!ghlApiKey || !ghlLocationId) {
      return new Response(
        JSON.stringify({ error: "GoHighLevel API is not fully configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contacts = await fetchContactsByEmail({
      apiBaseUrl: ghlApiBaseUrl,
      apiKey: ghlApiKey,
      locationId: ghlLocationId,
      email,
    });
    const match = contacts.find((contact) => (contact.email || "").trim().toLowerCase() === email);

    if (!match) {
      return new Response(
        JSON.stringify({ status: "free", source: "not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isPaidCommunity = hasPaidCommunityTag(match);
    const status: MembershipStatus = isPaidCommunity ? "premium" : "free";

    return new Response(
      JSON.stringify({
        status,
        hasPaidCommunityTag: isPaidCommunity,
        appliedTag: PAID_COMMUNITY_TAG,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
