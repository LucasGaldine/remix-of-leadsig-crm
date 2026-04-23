import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FALLBACK_SITE_BASE = "http://localhost:5173";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function toAbsoluteUrl(value: unknown): string | null {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeDomainBaseUrl(value: unknown): string | null {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

function getSiteBaseUrl(): string {
  const fromEnv = toAbsoluteUrl(Deno.env.get("SITE_URL") ?? null);
  return fromEnv ?? FALLBACK_SITE_BASE;
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function notFoundResponse() {
  return htmlResponse("<!doctype html><html><body>Website preview unavailable.</body></html>", 404);
}

function pickFirstAbsoluteUrl(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const absolute = toAbsoluteUrl(candidate);
    if (absolute) return absolute;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return htmlResponse("<!doctype html><html><body>Website preview unavailable.</body></html>", 500);
    }

    const url = new URL(req.url);
    const accountId = (url.searchParams.get("accountId") ?? "").trim();

    if (!accountId) {
      return notFoundResponse();
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: account } = await supabase
      .from("accounts")
      .select("company_name, logo_url, settings")
      .eq("id", accountId)
      .maybeSingle();

    if (!account) {
      return notFoundResponse();
    }

    const settings = asRecord(account.settings);
    const website = asRecord(settings?.website);
    const publishedRaw = website?.published;
    const isPublished = publishedRaw === true || publishedRaw === "true";

    if (!isPublished) {
      return notFoundResponse();
    }

    const hero = asRecord(website?.hero);
    const about = asRecord(website?.about);

    const services = Array.isArray(website?.services) ? website?.services : [];
    const testimonials = Array.isArray(website?.testimonials) ? website?.testimonials : [];

    const companyName = toTrimmedString(account.company_name) ?? "Business";
    const headline = toTrimmedString(hero?.headline);
    const subheadline = toTrimmedString(hero?.subheadline);

    const pageTitle = companyName;
    const description = subheadline ?? `Visit ${companyName} for professional services.`;

    const customDomainBase = normalizeDomainBaseUrl(website?.custom_domain);
    const siteBase = getSiteBaseUrl().replace(/\/$/, "");
    const destination = customDomainBase
      ? `${customDomainBase.replace(/\/$/, "")}/`
      : `${siteBase}/site/${encodeURIComponent(accountId)}`;

    const serviceImageCandidates = services
      .map((service) => asRecord(service)?.image_url)
      .filter((value) => typeof value === "string");

    const testimonialImageCandidates = testimonials
      .map((testimonial) => asRecord(testimonial)?.photo_url)
      .filter((value) => typeof value === "string");

    const shareImageUrl = pickFirstAbsoluteUrl([
      hero?.header_image_url,
      ...serviceImageCandidates,
      about?.before_image_url,
      about?.after_image_url,
      ...testimonialImageCandidates,
      account.logo_url,
    ]);

    const escapedTitle = escapeHtml(pageTitle);
    const escapedDescription = escapeHtml(description);
    const escapedDestination = escapeHtml(destination);
    const escapedUrl = escapeHtml(url.toString());
    const escapedSiteName = escapeHtml(companyName);
    const escapedHeadlineMeta = headline ? `\n    <meta property="og:image:alt" content="${escapeHtml(headline)}" />` : "";

    const imageMeta = shareImageUrl
      ? `\n    <meta property="og:image" content="${escapeHtml(shareImageUrl)}" />\n    <meta name="twitter:image" content="${escapeHtml(shareImageUrl)}" />${escapedHeadlineMeta}`
      : "";

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapedSiteName}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapedUrl}" />${imageMeta}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />

    <meta http-equiv="refresh" content="0;url=${escapedDestination}" />
  </head>
  <body>
    <script>
      window.location.replace(${JSON.stringify(destination)});
    </script>
    <noscript>
      <a href="${escapedDestination}">Open website</a>
    </noscript>
  </body>
</html>`;

    return htmlResponse(html);
  } catch (error) {
    console.error("website-share error:", error);
    return htmlResponse("<!doctype html><html><body>Website preview unavailable.</body></html>", 500);
  }
});
