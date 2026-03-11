import { LayoutDashboard, Users, FileText, Calendar, DollarSign, Settings, ChevronLeft, ChevronRight } from "lucide-react";
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
  { icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard", path: "/", requiredRole: 'all' },
  { icon: <Users className="h-5 w-5" />, label: "Leads", path: "/leads", badgeKey: "pendingLeads", requiredRole: 'manager' },
  { icon: <FileText className="h-5 w-5" />, label: "Jobs", path: "/jobs", requiredRole: 'all' },
  { icon: <Calendar className="h-5 w-5" />, label: "Calendar", path: "/schedule", requiredRole: 'all' },
  { icon: <DollarSign className="h-5 w-5" />, label: "Payments", path: "/payments", requiredRole: 'manager' },
  { icon: <Settings className="h-5 w-5" />, label: "Settings", path: "/settings", requiredRole: 'all' },
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

  const navigateToPrevious = () => {
    if (activeIndex > 0) {
      navigate(visibleNavItems[activeIndex - 1].path);
    }
  };

  const navigateToNext = () => {
    if (activeIndex < visibleNavItems.length - 1) {
      navigate(visibleNavItems[activeIndex + 1].path);
    }
  };

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
      <div className="md:flex md:items-stretch md:overflow-x-auto md:scrollbar-hide hidden">
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

      <div className="flex items-center justify-between md:hidden">
        <button
          onClick={navigateToPrevious}
          disabled={activeIndex === 0}
          className={cn(
            "p-2 transition-opacity",
            activeIndex === 0 ? "opacity-30" : "opacity-100"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex items-center justify-center gap-3 pt-2">
          {visibleNavItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex items-center justify-center transition-all",
                  "active:scale-95"
                )}
                aria-label={item.label}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground h-12 w-12"
                      : "text-muted-foreground h-10 w-10"
                  )}
                >
                  {item.icon}
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-status-attention text-white text-[9px] font-bold flex items-center justify-center">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={navigateToNext}
          disabled={activeIndex === visibleNavItems.length - 1}
          className={cn(
            "p-2 transition-opacity",
            activeIndex === visibleNavItems.length - 1 ? "opacity-30" : "opacity-100"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    </nav>
  );
}
