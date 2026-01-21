import { useState } from "react";
import { 
  User, 
  Building2, 
  DollarSign, 
  Bell, 
  Calendar, 
  Users, 
  Zap, 
  HelpCircle,
  LogOut,
  ChevronRight,
  MapPin,
  Shield,
  Plug,
  ExternalLink
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { TwoFactorSetup } from "@/components/auth/TwoFactorSetup";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface SettingItem {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  value?: string;
  variant?: "default" | "danger";
  comingSoon?: boolean;
  external?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function Settings() {
  const [show2FASetup, setShow2FASetup] = useState(false);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleHelpSupport = () => {
    window.open("mailto:support@leadsig.ai?subject=LeadSig Support Request", "_blank");
    toast.success("Opening email client");
  };

  const settingSections: SettingSection[] = [
    {
      title: "Business",
      items: [
        {
          icon: <Building2 className="h-5 w-5" />,
          label: "Company Profile",
          description: "Name, logo, contact info",
          onClick: () => navigate("/settings/company"),
        },
        {
          icon: <MapPin className="h-5 w-5" />,
          label: "Service Area",
          description: "Define where you work",
          comingSoon: true,
          onClick: () => navigate("/settings/service-area"),
        },
        {
          icon: <DollarSign className="h-5 w-5" />,
          label: "Pricing Rules",
          description: "Configure estimate calculations",
          onClick: () => navigate("/settings/pricing-rules"),
        },
        {
          icon: <DollarSign className="h-5 w-5" />,
          label: "Minimum Job Size",
          description: "Set your floor",
          value: "$2,500",
          comingSoon: true,
          onClick: () => navigate("/settings/min-job-size"),
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          icon: <DollarSign className="h-5 w-5" />,
          label: "Stripe Payments",
          description: "Accept credit cards",
          onClick: () => navigate("/settings/stripe"),
        },
      ],
    },
    {
      title: "Scheduling",
      items: [
        {
          icon: <Calendar className="h-5 w-5" />,
          label: "Availability",
          description: "Working hours and blocked dates",
          comingSoon: true,
          onClick: () => navigate("/settings/availability"),
        },
        {
          icon: <Users className="h-5 w-5" />,
          label: "Crew Management",
          description: "Teams and assignments",
          onClick: () => navigate("/settings/crew"),
        },
      ],
    },
    {
      title: "Automation",
      items: [
        {
          icon: <Zap className="h-5 w-5" />,
          label: "Auto-Responses",
          description: "Missed calls, follow-ups",
          comingSoon: true,
          onClick: () => navigate("/settings/auto-responses"),
        },
        {
          icon: <Bell className="h-5 w-5" />,
          label: "Notifications",
          description: "Push and SMS settings",
          comingSoon: true,
          onClick: () => navigate("/settings/notifications"),
        },
      ],
    },
    {
      title: "Integrations",
      items: [
        {
          icon: <Plug className="h-5 w-5" />,
          label: "Lead Sources",
          description: "Connect platforms to capture leads",
          onClick: () => navigate("/settings/lead-sources"),
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          icon: <Shield className="h-5 w-5" />,
          label: "Two-Factor Authentication",
          description: "Add extra security to your account",
          onClick: () => setShow2FASetup(true),
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          icon: <User className="h-5 w-5" />,
          label: "Profile",
          description: profile?.full_name || profile?.email || "Your account settings",
          onClick: () => navigate("/settings/profile"),
        },
        {
          icon: <HelpCircle className="h-5 w-5" />,
          label: "Help & Support",
          description: "Get assistance",
          onClick: handleHelpSupport,
          external: true,
        },
        {
          icon: <LogOut className="h-5 w-5" />,
          label: "Sign Out",
          variant: "danger",
          onClick: handleSignOut,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Settings" showNotifications={false} />

      <main className="py-4">
        {settingSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="px-4 mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {section.title}
            </h2>
            <div className="bg-card border-y border-border divide-y divide-border">
              {section.items.map((item, index) => (
                <button
                  key={index}
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 min-h-touch",
                    "text-left transition-colors",
                    item.onClick 
                      ? "hover:bg-muted/50 active:bg-muted cursor-pointer" 
                      : "cursor-default opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      item.variant === "danger"
                        ? "bg-status-attention-bg text-status-attention"
                        : item.comingSoon
                        ? "bg-muted text-muted-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "font-medium",
                          item.variant === "danger"
                            ? "text-status-attention"
                            : item.comingSoon
                            ? "text-muted-foreground"
                            : "text-foreground"
                        )}
                      >
                        {item.label}
                      </p>
                      {item.comingSoon && (
                        <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                          Soon
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {item.value && !item.comingSoon && (
                    <span className="text-sm text-muted-foreground">
                      {item.value}
                    </span>
                  )}
                  {item.external ? (
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : item.onClick && !item.comingSoon ? (
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-sm text-muted-foreground mt-8">
          LeadSig CRM v1.0
        </p>
      </main>

      <MobileNav />

      <TwoFactorSetup open={show2FASetup} onOpenChange={setShow2FASetup} />
    </div>
  );
}
