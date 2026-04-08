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
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Address Validation API not configured" }),
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

    const addressLines = [address1, address2].filter((part): part is string => Boolean(part && part.trim()));
    const googleResponse = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: {
            regionCode: "US",
            addressLines,
            locality: city || undefined,
            administrativeArea: state || undefined,
            postalCode: zip || undefined,
          },
          enableUspsCass: true,
        }),
      },
    );

    if (!googleResponse.ok) {
      const bodyText = await googleResponse.text();
      let message = "Address validation request failed";
      try {
        const parsed = JSON.parse(bodyText) as {
          error?: { message?: string };
        };
        if (parsed?.error?.message) {
          message = parsed.error.message;
        }
      } catch {
        if (bodyText) {
          message = bodyText;
        }
      }
      return new Response(
        JSON.stringify({ verified: false, error: message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await googleResponse.json() as {
      result?: {
        verdict?: {
          addressComplete?: boolean;
        };
        address?: {
          formattedAddress?: string;
          postalAddress?: {
            addressLines?: string[];
            locality?: string;
            administrativeArea?: string;
            postalCode?: string;
          };
        };
      };
    };

    const verdict = payload.result?.verdict;
    const postalAddress = payload.result?.address?.postalAddress;
    const normalizedPostalCode = (postalAddress?.postalCode || "").trim();
    const [zip5 = "", zip4 = ""] = normalizedPostalCode.split("-");

    const verifiedAddress = {
      address1: postalAddress?.addressLines?.[0] || address1,
      address2: postalAddress?.addressLines?.[1] || "",
      city: postalAddress?.locality || city || "",
      state: postalAddress?.administrativeArea || state || "",
      zip5,
      zip4,
    };

    const fallbackFormatted = [
      verifiedAddress.address1,
      verifiedAddress.address2,
      `${verifiedAddress.city}, ${verifiedAddress.state} ${[
        verifiedAddress.zip5,
        verifiedAddress.zip4 ? `-${verifiedAddress.zip4}` : "",
      ].join("")}`.trim(),
    ].filter(Boolean).join(", ");

    const formattedAddress = payload.result?.address?.formattedAddress?.replace(/\n/g, ", ").trim() || fallbackFormatted;

    if (!verdict?.addressComplete || !formattedAddress) {
      return new Response(
        JSON.stringify({ verified: false, error: "Unable to verify this address" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ verified: true, address: verifiedAddress, formatted: formattedAddress }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
