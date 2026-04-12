export function buildClientPortalUrl(token: string, jobId?: string): string {
  const params = new URLSearchParams({ token });
  if (jobId) {
    params.set("jobId", jobId);
  }
  return `/client/job?${params.toString()}`;
}

export function buildClientPortalShareUrl(token: string, jobId?: string): string {
  const directPath = buildClientPortalUrl(token, jobId);
  const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (configuredSiteUrl) {
    return `${configuredSiteUrl.replace(/\/$/, "")}${directPath}`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${directPath}`;
  }

  return directPath;
}
