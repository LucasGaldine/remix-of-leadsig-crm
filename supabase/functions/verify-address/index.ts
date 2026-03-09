import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AddressInput {
  address1: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = Deno.env.get("USPS_USER_ID");
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "USPS API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address1, address2, city, state, zip } = (await req.json()) as AddressInput;

    if (!address1) {
      return new Response(
        JSON.stringify({ error: "address1 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build USPS XML request
    const xml = `<AddressValidateRequest USERID="${userId}"><Address ID="0"><Address1>${escapeXml(address2 || "")}</Address1><Address2>${escapeXml(address1)}</Address2><City>${escapeXml(city || "")}</City><State>${escapeXml(state || "")}</State><Zip5>${escapeXml(zip || "")}</Zip5><Zip4></Zip4></Address></AddressValidateRequest>`;

    const url = `https://secure.shippingapis.com/ShippingAPI.dll?API=Verify&XML=${encodeURIComponent(xml)}`;

    const res = await fetch(url);
    const text = await res.text();

    // Parse response
    const errorMatch = text.match(/<Description>(.*?)<\/Description>/);
    if (errorMatch && text.includes("<Error>")) {
      return new Response(
        JSON.stringify({ verified: false, error: errorMatch[1] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const get = (tag: string) => {
      const m = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      return m ? m[1] : "";
    };

    // USPS swaps Address1/Address2 (Address2 = street line)
    const verified = {
      address1: get("Address2"),
      address2: get("Address1"),
      city: get("City"),
      state: get("State"),
      zip5: get("Zip5"),
      zip4: get("Zip4"),
    };

    const fullAddress = [
      verified.address1,
      verified.address2,
      `${verified.city}, ${verified.state} ${verified.zip5}${verified.zip4 ? `-${verified.zip4}` : ""}`,
    ]
      .filter(Boolean)
      .join(", ");

    return new Response(
      JSON.stringify({ verified: true, address: verified, formatted: fullAddress }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
