import type { AppRole } from "@/hooks/useAuth";

export interface SearchPage {
  name: string;
  path: string;
  icon: "home" | "users" | "briefcase" | "dollar-sign" | "settings" | "calendar" | "layout-dashboard" | "crown" | "book-open";
  description?: string;
  roles?: AppRole[];
  keywords?: string[];
}

export const searchPages: SearchPage[] = [
  {
    name: "Dashboard",
    path: "/",
    icon: "home",
    description: "Overview and stats",
    keywords: ["home", "main", "overview", "stats", "metrics"],
  },
  {
    name: "Leads",
    path: "/leads",
    icon: "users",
    description: "Manage incoming leads",
    keywords: ["prospects", "potential customers", "new leads"],
  },
  {
    name: "Pending Leads",
    path: "/leads/pending-approval",
    icon: "users",
    description: "Leads awaiting approval",
    keywords: ["approval", "pending approval", "review"],
  },
  {
    name: "Rejected Leads",
    path: "/leads/rejected",
    icon: "users",
    description: "Declined leads",
    keywords: ["declined", "rejected"],
  },
  {
    name: "Jobs",
    path: "/jobs",
    icon: "briefcase",
    description: "Active and completed work",
    keywords: ["projects", "work orders", "tasks"],
  },
  {
    name: "Schedule",
    path: "/schedule",
    icon: "calendar",
    description: "Calendar and appointments",
    keywords: ["calendar", "appointments", "timeline", "booking"],
  },
  {
    name: "Customers",
    path: "/customers",
    icon: "users",
    description: "Client directory",
    keywords: ["clients", "contacts"],
  },
  {
    name: "Payments",
    path: "/payments",
    icon: "dollar-sign",
    description: "Invoices and transactions",
    keywords: ["billing", "invoices", "revenue", "money"],
  },
  {
    name: "Replay Tutorial",
    path: "/tutorial",
    icon: "book-open",
    description: "Walk through how LeadSig works",
    keywords: ["tutorial", "onboarding", "walkthrough", "guide", "help", "training"],
  },
  {
    name: "Replay Import Setup",
    path: "/onboarding/import",
    icon: "book-open",
    description: "Run the CSV import onboarding again",
    keywords: ["import", "csv", "onboarding", "setup", "leads", "clients", "jobs", "replay"],
  },
  {
    name: "Lead Sources",
    path: "/settings/lead-sources",
    icon: "layout-dashboard",
    description: "Integration settings",
    roles: ["owner"],
    keywords: ["integrations", "api", "connections", "facebook"],
  },
  {
    name: "API Keys",
    path: "/settings/api-keys",
    icon: "layout-dashboard",
    description: "Developer access",
    roles: ["owner"],
    keywords: ["developer", "api", "keys", "integration"],
  },
  {
    name: "Settings",
    path: "/settings",
    icon: "settings",
    description: "Account and preferences",
    keywords: ["preferences", "configuration", "setup"],
  },
  {
    name: "Report a Bug",
    path: "/settings?reportBug=1",
    icon: "settings",
    description: "Send bug details to support",
    keywords: ["bug", "report", "issue", "broken", "problem", "support"],
  },
  {
    name: "Company Profile",
    path: "/settings/company",
    icon: "settings",
    description: "Business information",
    roles: ["owner", "sales"],
    keywords: ["business", "company name", "logo", "contact"],
  },
  {
    name: "Service Area",
    path: "/settings/service-area",
    icon: "settings",
    description: "Coverage and geofence",
    roles: ["owner", "sales"],
    keywords: ["geofence", "coverage", "location", "radius"],
  },
  {
    name: "Pricing Rules",
    path: "/settings/pricing-rules",
    icon: "settings",
    description: "Estimate calculations",
    roles: ["owner", "sales"],
    keywords: ["pricing", "rates", "estimates", "calculator"],
  },
  {
    name: "Availability",
    path: "/settings/availability",
    icon: "settings",
    description: "Working hours and days off",
    keywords: ["schedule", "hours", "calendar", "business hours"],
  },
  {
    name: "Crew Management",
    path: "/settings/crew",
    icon: "settings",
    description: "Team members",
    keywords: ["team", "staff", "employees", "workers"],
  },
  {
    name: "Auto-Responses",
    path: "/settings/auto-responses",
    icon: "settings",
    description: "Automated messages",
    keywords: ["automation", "sms", "messages"],
  },
  {
    name: "Notifications",
    path: "/settings/notifications",
    icon: "settings",
    description: "Alerts and reminders",
    keywords: ["alerts", "push", "sms", "email"],
  },
  {
    name: "Stripe Payments",
    path: "/settings/stripe",
    icon: "settings",
    description: "Payment processing",
    roles: ["owner"],
    keywords: ["stripe", "payments", "credit card"],
  },
  {
    name: "Dashboard Settings",
    path: "/settings/dashboard",
    icon: "settings",
    description: "Customize stats",
    roles: ["owner", "sales"],
    keywords: ["dashboard", "widgets", "cards"],
  },
  {
    name: "Profile",
    path: "/settings/profile",
    icon: "settings",
    description: "Account details",
    keywords: ["account", "password", "email"],
  },
  {
    name: "Pricing Plans",
    path: "/settings/pricing",
    icon: "crown",
    description: "Subscription management",
    roles: ["owner"],
    keywords: ["subscription", "billing", "upgrade", "plan"],
  },
];

export function filterSearchPages(query: string, role: AppRole | null) {
  if (!query) {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  return searchPages
    .filter((page) => {
      if (page.roles && (!role || !page.roles.includes(role))) {
        return false;
      }

      return (
        page.name.toLowerCase().includes(lowerQuery) ||
        page.description?.toLowerCase().includes(lowerQuery) ||
        page.path.toLowerCase().includes(lowerQuery) ||
        page.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
      );
    })
    .slice(0, 8);
}
