import { LayoutDashboard, Users, FileText, Calendar, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badgeKey?: string;
  requiredRole?: 'manager' | 'all';
}

const navItems: NavItem[] = [
  { icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard", path: "/", requiredRole: 'all' },
  { icon: <Users className="h-5 w-5" />, label: "Leads", path: "/leads", badgeKey: "pendingLeads", requiredRole: 'manager' },
  { icon: <FileText className="h-5 w-5" />, label: "Jobs", path: "/jobs", requiredRole: 'all' },
  { icon: <Calendar className="h-5 w-5" />, label: "Calendar", path: "/schedule", requiredRole: 'all' },
  { icon: <DollarSign className="h-5 w-5" />, label: "Payments", path: "/payments", requiredRole: 'manager' },
  { icon: <Settings className="h-5 w-5" />, label: "Settings", path: "/settings", requiredRole: 'all' },
];

export function DesktopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCrewMember } = useAuth();
  const { data: pendingLeadsCount = 0 } = usePendingLeadsCount();

  const badges: Record<string, number> = {
    pendingLeads: pendingLeadsCount,
  };

  const visibleNavItems = navItems.filter(item => {
    if (!item.requiredRole || item.requiredRole === 'all') return true;
    if (item.requiredRole === 'manager') return !isCrewMember();
    return true;
  });

  const isActiveRoute = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-40 flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="flex-1 px-3 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = isActiveRoute(item.path);
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                "hover:bg-muted",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-foreground"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {badgeCount > 0 && (
                <span className="ml-auto h-5 w-5 rounded-full bg-status-attention text-white text-xs font-bold flex items-center justify-center">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
