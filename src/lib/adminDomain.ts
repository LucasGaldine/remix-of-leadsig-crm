export const ADMIN_APP_HOSTNAME = "admin.leadsig.ai";

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase();

const normalizePathname = (pathname: string): string => {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
};

const normalizeSegment = (segment: string, prefix: "?" | "#"): string => {
  if (!segment) return "";
  return segment.startsWith(prefix) ? segment : `${prefix}${segment}`;
};

export const isAdminAppHostname = (hostname: string): boolean =>
  normalizeHostname(hostname) === ADMIN_APP_HOSTNAME;

export const buildAdminAppUrl = (
  pathname: string,
  search = "",
  hash = ""
): string => {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedSearch = normalizeSegment(search, "?");
  const normalizedHash = normalizeSegment(hash, "#");

  return `https://${ADMIN_APP_HOSTNAME}${normalizedPathname}${normalizedSearch}${normalizedHash}`;
};
