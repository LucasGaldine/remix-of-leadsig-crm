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

  const getVisibleItems = () => {
    const allItems = visibleNavItems;
    const currentIdx = activeIndex;

    if (allItems.length <= 5) return allItems;

    const visibleCount = 5;
    const halfVisible = Math.floor(visibleCount / 2);

    let start = Math.max(0, currentIdx - halfVisible);
    let end = Math.min(allItems.length, start + visibleCount);

    if (end - start < visibleCount) {
      start = Math.max(0, end - visibleCount);
    }

    return allItems.slice(start, end);
  };

  const itemsToShow = getVisibleItems();
  const canGoLeft = activeIndex > 0;
  const canGoRight = activeIndex < visibleNavItems.length - 1;

  const goLeft = () => {
    if (canGoLeft) {
      navigate(visibleNavItems[activeIndex - 1].path);
    }
  };

  const goRight = () => {
    if (canGoRight) {
      navigate(visibleNavItems[activeIndex + 1].path);
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <button
          onClick={goLeft}
          disabled={!canGoLeft}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg transition-all",
            canGoLeft
              ? "text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center justify-center gap-2 flex-1">
          {itemsToShow.map((item) => {
            const isActive = isActiveRoute(item.path);
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex items-center justify-center p-3 rounded-xl transition-all duration-300",
                  "active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg scale-110"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label={item.label}
              >
                {item.icon}
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-status-attention text-white text-[9px] font-bold flex items-center justify-center shadow-md">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={goRight}
          disabled={!canGoRight}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg transition-all",
            canGoRight
              ? "text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
