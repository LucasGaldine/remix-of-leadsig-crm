import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Chrome as Home, Users, Briefcase, DollarSign, FileText, Settings, Calendar, LayoutDashboard, Search, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

interface Page {
  name: string;
  path: string;
  icon: React.ReactNode;
  description?: string;
  roles?: string[];
  keywords?: string[];
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { role } = useAuth();

  const pages: Page[] = [
    {
      name: "Dashboard",
      path: "/",
      icon: <Home className="h-4 w-4" />,
      description: "Overview and stats",
      keywords: ["home", "main", "overview", "stats", "metrics"],
    },
    {
      name: "Leads",
      path: "/leads",
      icon: <Users className="h-4 w-4" />,
      description: "Manage incoming leads",
      keywords: ["prospects", "potential customers", "new leads"],
    },
    {
      name: "Pending Leads",
      path: "/leads/pending",
      icon: <Users className="h-4 w-4" />,
      description: "Leads awaiting approval",
      keywords: ["approval", "pending approval", "review"],
    },
    {
      name: "Rejected Leads",
      path: "/leads/rejected",
      icon: <Users className="h-4 w-4" />,
      description: "Declined leads",
      keywords: ["declined", "rejected"],
    },
    {
      name: "Jobs",
      path: "/jobs",
      icon: <Briefcase className="h-4 w-4" />,
      description: "Active and completed work",
      keywords: ["projects", "work orders", "tasks"],
    },
    {
      name: "Schedule",
      path: "/schedule",
      icon: <Calendar className="h-4 w-4" />,
      description: "Calendar and appointments",
      keywords: ["calendar", "appointments", "timeline", "booking"],
    },
    {
      name: "Customers",
      path: "/customers",
      icon: <Users className="h-4 w-4" />,
      description: "Client directory",
      keywords: ["clients", "contacts"],
    },
    {
      name: "Payments",
      path: "/payments",
      icon: <DollarSign className="h-4 w-4" />,
      description: "Invoices and transactions",
      keywords: ["billing", "invoices", "revenue", "money"],
    },
    {
      name: "Materials",
      path: "/materials",
      icon: <FileText className="h-4 w-4" />,
      description: "Inventory and supply orders",
      roles: ["owner", "sales"],
      keywords: ["inventory", "supplies", "stock", "orders"],
    },
    {
      name: "Lead Sources",
      path: "/settings/lead-sources",
      icon: <LayoutDashboard className="h-4 w-4" />,
      description: "Integration settings",
      roles: ["owner"],
      keywords: ["integrations", "api", "connections", "facebook"],
    },
    {
      name: "API Keys",
      path: "/settings/api-keys",
      icon: <LayoutDashboard className="h-4 w-4" />,
      description: "Developer access",
      roles: ["owner"],
      keywords: ["developer", "api", "keys", "integration"],
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <Settings className="h-4 w-4" />,
      description: "Account and preferences",
      keywords: ["preferences", "configuration", "setup"],
    },
    {
      name: "Company Profile",
      path: "/settings/company",
      icon: <Settings className="h-4 w-4" />,
      description: "Business information",
      roles: ["owner", "sales"],
      keywords: ["business", "company name", "logo", "contact"],
    },
    {
      name: "Service Area",
      path: "/settings/service-area",
      icon: <Settings className="h-4 w-4" />,
      description: "Coverage and geofence",
      roles: ["owner", "sales"],
      keywords: ["geofence", "coverage", "location", "radius"],
    },
    {
      name: "Pricing Rules",
      path: "/settings/pricing-rules",
      icon: <Settings className="h-4 w-4" />,
      description: "Estimate calculations",
      roles: ["owner", "sales"],
      keywords: ["pricing", "rates", "estimates", "calculator"],
    },
    {
      name: "Availability",
      path: "/settings/availability",
      icon: <Settings className="h-4 w-4" />,
      description: "Working hours and days off",
      keywords: ["schedule", "hours", "calendar", "business hours"],
    },
    {
      name: "Crew Management",
      path: "/settings/crew",
      icon: <Settings className="h-4 w-4" />,
      description: "Team members",
      keywords: ["team", "staff", "employees", "workers"],
    },
    {
      name: "Auto-Responses",
      path: "/settings/auto-responses",
      icon: <Settings className="h-4 w-4" />,
      description: "Automated messages",
      keywords: ["automation", "sms", "messages"],
    },
    {
      name: "Notifications",
      path: "/settings/notifications",
      icon: <Settings className="h-4 w-4" />,
      description: "Alerts and reminders",
      keywords: ["alerts", "push", "sms", "email"],
    },
    {
      name: "Stripe Payments",
      path: "/settings/stripe",
      icon: <Settings className="h-4 w-4" />,
      description: "Payment processing",
      roles: ["owner"],
      keywords: ["stripe", "payments", "credit card"],
    },
    {
      name: "Dashboard Settings",
      path: "/settings/dashboard",
      icon: <Settings className="h-4 w-4" />,
      description: "Customize stats",
      roles: ["owner", "sales"],
      keywords: ["dashboard", "widgets", "cards"],
    },
    {
      name: "Profile",
      path: "/settings/profile",
      icon: <Settings className="h-4 w-4" />,
      description: "Account details",
      keywords: ["account", "password", "email"],
    },
    {
      name: "Pricing Plans",
      path: "/settings/pricing",
      icon: <Crown className="h-4 w-4" />,
      description: "Subscription management",
      roles: ["owner"],
      keywords: ["subscription", "billing", "upgrade", "plan"],
    },
  ];

  const filteredPages = useMemo(() => {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    return pages
      .filter((page) => {
        if (page.roles && !page.roles.includes(role)) return false;

        return (
          page.name.toLowerCase().includes(lowerQuery) ||
          page.description?.toLowerCase().includes(lowerQuery) ||
          page.path.toLowerCase().includes(lowerQuery) ||
          page.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
        );
      })
      .slice(0, 8);
  }, [query, role]);

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Search Pages</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {filteredPages.length > 0 ? (
            <div className="py-2">
              {filteredPages.map((page) => (
                <button
                  key={page.path}
                  onClick={() => handleSelect(page.path)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-secondary text-secondary-foreground">
                    {page.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{page.name}</p>
                    {page.description && (
                      <p className="text-sm text-muted-foreground">{page.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No pages found</p>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Start typing to search...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
