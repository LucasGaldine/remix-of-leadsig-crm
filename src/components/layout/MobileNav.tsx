import { LayoutDashboard, Users, FileText, Calendar, DollarSign, Settings, ChevronLeft, ChevronRight } from "lucide-react";
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
  { icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard", path: "/", requiredRole: 'all' },
  { icon: <Users className="h-4 w-4" />, label: "Leads", path: "/leads", badgeKey: "pendingLeads", requiredRole: 'manager' },
  { icon: <FileText className="h-4 w-4" />, label: "Jobs", path: "/jobs", requiredRole: 'all' },
  { icon: <Calendar className="h-4 w-4" />, label: "Calendar", path: "/schedule", requiredRole: 'all' },
  { icon: <DollarSign className="h-4 w-4" />, label: "Payments", path: "/payments", requiredRole: 'manager' },
  { icon: <Settings className="h-4 w-4" />, label: "Settings", path: "/settings", requiredRole: 'all' },
];

export function MobileNav() {
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

  const currentIndex = visibleNavItems.findIndex(item => isActiveRoute(item.path));
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  const goLeft = () => {
    if (activeIndex > 0) navigate(visibleNavItems[activeIndex - 1].path);
  };

  const goRight = () => {
    if (activeIndex < visibleNavItems.length - 1) navigate(visibleNavItems[activeIndex + 1].path);
  };

  const currentLabel = visibleNavItems[activeIndex]?.label || "";

  return (
    <>
      {/* Mobile: Left arrow */}
      {activeIndex > 0 && (
        <button
          onClick={goLeft}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-r-xl shadow-md active:bg-muted transition-colors md:hidden"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
      )}

      {/* Mobile: Right arrow */}
      {activeIndex < visibleNavItems.length - 1 && (
        <button
          onClick={goRight}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-l-xl shadow-md active:bg-muted transition-colors md:hidden"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
        {/* Mobile: dot indicator + label */}
        <div className="flex items-center justify-center py-2.5 gap-3 md:hidden">
          <div className="flex items-center gap-1.5">
            {visibleNavItems.map((item, i) => (
              <div
                key={item.path}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === activeIndex
                    ? "w-5 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-foreground ml-1">
            {currentLabel}
          </span>
        </div>

        {/* Desktop: full tab bar */}
        <div className="hidden md:flex items-stretch overflow-x-auto scrollbar-hide">
          {visibleNavItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] min-w-[52px] transition-colors",
                  "active:bg-muted",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "relative p-1 rounded-lg transition-colors",
                    isActive && "bg-primary/10"
                  )}
                >
                  {item.icon}
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-status-attention text-white text-[9px] font-bold flex items-center justify-center">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-0.5 leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
