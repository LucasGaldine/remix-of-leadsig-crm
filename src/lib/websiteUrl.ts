type BuildWebsitePublicUrlOptions = {
  customDomain?: string | null;
  baseUrl?: string | null;
};

type BuildWebsiteShareUrlOptions = BuildWebsitePublicUrlOptions & {
  supabaseUrl?: string | null;
};

function normalizeCustomDomainBaseUrl(customDomain?: string | null): string | null {
  if (!customDomain) return null;

  const trimmed = customDomain.trim();
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

export function buildWebsitePublicUrl(
  accountId: string,
  options?: BuildWebsitePublicUrlOptions,
): string {
  const sanitizedAccountId = accountId.trim();
  const directPath = `/site/${sanitizedAccountId}`;

  const fromCustomDomain = normalizeCustomDomainBaseUrl(options?.customDomain);
  if (fromCustomDomain) {
    return `${fromCustomDomain.replace(/\/$/, "")}${directPath}`;
  }

  const fromExplicitBase = options?.baseUrl?.trim();
  if (fromExplicitBase) {
    return `${fromExplicitBase.replace(/\/$/, "")}${directPath}`;
  }

  const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (configuredSiteUrl) {
    return `${configuredSiteUrl.replace(/\/$/, "")}${directPath}`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${directPath}`;
  }

  return directPath;
}

function normalizeSupabaseBaseUrl(supabaseUrl?: string | null): string | null {
  if (!supabaseUrl) return null;
  const trimmed = supabaseUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

export function buildWebsiteShareUrl(
  accountId: string,
  options?: BuildWebsiteShareUrlOptions,
): string {
  const sanitizedAccountId = accountId.trim();
  const fallbackUrl = buildWebsitePublicUrl(sanitizedAccountId, options);
  const fromExplicitSupabase = normalizeSupabaseBaseUrl(options?.supabaseUrl);
  const fromConfiguredSupabase = normalizeSupabaseBaseUrl(import.meta.env.VITE_SUPABASE_URL?.trim());
  const supabaseBaseUrl = fromExplicitSupabase ?? fromConfiguredSupabase;

  if (!supabaseBaseUrl) {
    return fallbackUrl;
  }

  const params = new URLSearchParams({ accountId: sanitizedAccountId });
  return `${supabaseBaseUrl}/functions/v1/website-share?${params.toString()}`;
}
