import { LayoutDashboard, Users, FileText, Calendar, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";
import { UserMenu } from "./UserMenu";

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
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 md:bg-card md:border-r md:border-border">
      <div className="flex flex-col h-full">
        <div className="flex items-center h-16 px-6 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">LawnFlow</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-3">
            {visibleNavItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    {item.icon}
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-status-attention text-white text-[9px] font-bold flex items-center justify-center">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                  </div>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
