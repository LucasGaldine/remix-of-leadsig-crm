import type { WebsiteHiringRole } from "@/hooks/useWebsiteSettings";

export function isPublishedHiringRole(role: WebsiteHiringRole): boolean {
  const normalizedStatus = role.status?.trim().toLowerCase();
  return normalizedStatus === "published" || normalizedStatus === "active";
}
