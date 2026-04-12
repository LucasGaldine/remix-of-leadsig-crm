import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FALLBACK_PORTAL_BASE = "http://localhost:5173";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toAbsoluteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getPortalBaseUrl(): string {
  const fromEnv = toAbsoluteUrl(Deno.env.get("SITE_URL") ?? null);
  return fromEnv ?? FALLBACK_PORTAL_BASE;
}

function extractCustomerName(customer: unknown): string | null {
  if (!customer) return null;

  if (Array.isArray(customer)) {
    const first = customer[0];
    if (first && typeof first === "object" && "name" in first && typeof first.name === "string") {
      const trimmed = first.name.trim();
      return trimmed || null;
    }
    return null;
  }

  if (typeof customer === "object" && "name" in customer && typeof customer.name === "string") {
    const trimmed = customer.name.trim();
    return trimmed || null;
  }

  return null;
}

function buildPortalDestination(baseUrl: string, token: string, jobId: string | null): string {
  const params = new URLSearchParams({ token });
  if (jobId) params.set("jobId", jobId);
  return `${baseUrl.replace(/\/$/, "")}/client/job?${params.toString()}`;
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
  return htmlResponse("<!doctype html><html><body>Invalid client portal link.</body></html>", 404);
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
      return htmlResponse("<!doctype html><html><body>Portal preview unavailable.</body></html>", 500);
    }

    const url = new URL(req.url);
    const token = (url.searchParams.get("token") ?? "").trim();
    const jobId = (url.searchParams.get("jobId") ?? "").trim() || null;

    if (!token) {
      return notFoundResponse();
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let accountId: string | null = null;
    let customerName: string | null = null;

    const { data: customer } = await supabase
      .from("customers")
      .select("name, account_id")
      .eq("client_portal_token", token)
      .maybeSingle();

    if (customer) {
      accountId = customer.account_id ?? null;
      customerName = customer.name?.trim() || null;
    } else {
      const { data: recurringJob } = await supabase
        .from("recurring_jobs")
        .select("account_id, customer:customers!customer_id(name)")
        .eq("client_share_token", token)
        .maybeSingle();

      if (recurringJob) {
        accountId = recurringJob.account_id ?? null;
        customerName = extractCustomerName(recurringJob.customer);
      } else {
        const { data: lead } = await supabase
          .from("leads")
          .select("account_id, customer:customers!customer_id(name)")
          .eq("client_share_token", token)
          .maybeSingle();

        if (!lead) {
          return notFoundResponse();
        }

        accountId = lead.account_id ?? null;
        customerName = extractCustomerName(lead.customer);
      }
    }

    const { data: account } = accountId
      ? await supabase
          .from("accounts")
          .select("company_name, logo_url")
          .eq("id", accountId)
          .maybeSingle()
      : { data: null as { company_name?: string | null; logo_url?: string | null } | null };

    const companyName = account?.company_name?.trim() || null;
    const logoUrl = toAbsoluteUrl(account?.logo_url ?? null);
    const pageTitle = customerName ? `${customerName} | Client Portal` : "Client Portal";
    const description = companyName
      ? `Open your ${companyName} client portal to view jobs, schedules, photos, estimates, and invoices.`
      : "Open your client portal to view jobs, schedules, photos, estimates, and invoices.";

    const portalBase = getPortalBaseUrl();
    const destination = buildPortalDestination(portalBase, token, jobId);

    const escapedTitle = escapeHtml(pageTitle);
    const escapedDescription = escapeHtml(description);
    const escapedDestination = escapeHtml(destination);

    const imageMeta = logoUrl
      ? `\n    <meta property="og:image" content="${escapeHtml(logoUrl)}" />\n    <meta name="twitter:image" content="${escapeHtml(logoUrl)}" />`
      : "";

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapeHtml(url.toString())}" />${imageMeta}

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
      <a href="${escapedDestination}">Open Client Portal</a>
    </noscript>
  </body>
</html>`;

    return htmlResponse(html);
  } catch (error) {
    console.error("client-portal-share error:", error);
    return htmlResponse("<!doctype html><html><body>Portal preview unavailable.</body></html>", 500);
  }
});
