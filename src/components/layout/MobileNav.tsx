import { LayoutDashboard, Users, FileText, Calendar, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";
import { useEffect, useRef } from "react";

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
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

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

  const handleSwipe = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && activeIndex < visibleNavItems.length - 1) {
      navigate(visibleNavItems[activeIndex + 1].path);
    }

    if (isRightSwipe && activeIndex > 0) {
      navigate(visibleNavItems[activeIndex - 1].path);
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
    };

    const onTouchEnd = () => {
      handleSwipe();
    };

    document.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeIndex, visibleNavItems]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-stretch overflow-x-auto scrollbar-hide">
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
  );
}
