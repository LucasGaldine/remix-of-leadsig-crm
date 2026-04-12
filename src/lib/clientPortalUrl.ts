export function buildClientPortalUrl(token: string, jobId?: string): string {
  const params = new URLSearchParams({ token });
  if (jobId) {
    params.set("jobId", jobId);
  }
  return `/client/job?${params.toString()}`;
}

export function buildClientPortalShareUrl(token: string, jobId?: string): string {
  const params = new URLSearchParams({ token });
  if (jobId) {
    params.set("jobId", jobId);
  }
  return `/client-portal-share.html?${params.toString()}`;
}
