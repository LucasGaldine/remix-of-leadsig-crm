const POST_URL_KEYS = [
  "post_url",
  "postUrl",
  "post_link",
  "postLink",
  "url",
  "link",
  "external_url",
  "externalUrl",
  "permalink",
  "permalink_url",
  "linkedin_url",
  "linkedinUrl",
];

const PLATFORM_KEYS = [
  "platform",
  "platform_name",
  "platformName",
  "network",
  "source_platform",
  "sourcePlatform",
];

type UnknownRecord = Record<string, unknown> | null;

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function findMetadataString(metadata: UnknownRecord, keys: string[]): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = readString(metadata[key]);
    if (value) return value;
  }
  return null;
}

function toHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizePlatform(platform: string | null): string | null {
  if (!platform) return null;
  const normalized = platform.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "linkedin" || normalized === "linked in") return "LinkedIn";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "x" || normalized === "twitter") return "X";
  if (normalized === "youtube") return "YouTube";
  if (normalized === "tiktok") return "TikTok";
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferPlatformFromUrl(postUrl: string | null): string | null {
  if (!postUrl) return null;
  try {
    const host = new URL(postUrl).hostname.toLowerCase();
    if (host.includes("linkedin.com")) return "LinkedIn";
    if (host.includes("facebook.com")) return "Facebook";
    if (host.includes("instagram.com")) return "Instagram";
    if (host.includes("twitter.com") || host.includes("x.com")) return "X";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
    if (host.includes("tiktok.com")) return "TikTok";
  } catch {
    return null;
  }
  return null;
}

function findUrlInText(...texts: Array<string | null | undefined>): string | null {
  for (const text of texts) {
    if (!text) continue;
    const match = text.match(/https?:\/\/[^\s)]+/i);
    const sanitized = toHttpUrl(match?.[0] ?? null);
    if (sanitized) return sanitized;
  }
  return null;
}

export function getInteractionPostUrl(
  metadata: UnknownRecord,
  ...texts: Array<string | null | undefined>
): string | null {
  const fromMetadata = toHttpUrl(findMetadataString(metadata, POST_URL_KEYS));
  if (fromMetadata) return fromMetadata;
  return findUrlInText(...texts);
}

export function getInteractionPostLabel(
  metadata: UnknownRecord,
  postUrl: string | null,
): string {
  const platform = normalizePlatform(findMetadataString(metadata, PLATFORM_KEYS))
    ?? inferPlatformFromUrl(postUrl);
  return platform ? `View on ${platform}` : "View Post";
}
