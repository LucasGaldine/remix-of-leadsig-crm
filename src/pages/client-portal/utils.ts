import type { CompanyData, ScheduleItem } from "./types";

export function formatServiceType(serviceType: string): string {
  return serviceType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getStatusLabel(status: string, schedules: ScheduleItem[]): string {
  if (status === "paid") return "Paid";
  if (status === "completed") return "Completed";
  if (status === "job" && schedules.length > 0) {
    const now = new Date();
    const sorted = [...schedules].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    const last = sorted[sorted.length - 1];
    const lastEnd = new Date(`${last.scheduled_date}T${last.scheduled_time_end || "23:59:59"}`);
    const first = sorted[0];
    const firstStart = new Date(`${first.scheduled_date}T${first.scheduled_time_start || "00:00:00"}`);

    if (now > lastEnd) return "Completed";
    if (now >= firstStart) return "In Progress";
    return "Scheduled";
  }
  return "Pending";
}

export function getStatusColor(status: string, schedules: ScheduleItem[]): string {
  const label = getStatusLabel(status, schedules);
  switch (label) {
    case "Paid":
      return "bg-emerald-100 text-emerald-800";
    case "Completed":
      return "bg-blue-100 text-blue-800";
    case "In Progress":
      return "bg-amber-100 text-amber-800";
    case "Scheduled":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export function isPastProjectStatus(status: string): boolean {
  return status === "completed" || status === "paid";
}

export function formatWebsiteUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function resolveCompanyWebsite(company: CompanyData): string | null {
  const websiteValue = company.website;

  if (typeof websiteValue === "string") {
    const trimmedWebsite = websiteValue.trim();
    return trimmedWebsite || null;
  }

  if (!websiteValue || typeof websiteValue !== "object") {
    return null;
  }

  const customDomain = websiteValue.custom_domain?.trim();
  if (customDomain) {
    return customDomain;
  }

  const slug = websiteValue.slug?.trim();
  if (slug) {
    return slug;
  }

  return null;
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
