import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  label: string;
  path: string;
  requiredRole?: 'manager' | 'all';
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", requiredRole: 'all' },
  { label: "Leads", path: "/leads", requiredRole: 'manager' },
  { label: "Jobs", path: "/jobs", requiredRole: 'all' },
  { label: "Calendar", path: "/schedule", requiredRole: 'all' },
  { label: "Payments", path: "/payments", requiredRole: 'manager' },
  { label: "Settings", path: "/settings", requiredRole: 'all' },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCrewMember } = useAuth();

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
    if (activeIndex > 0) {
      navigate(visibleNavItems[activeIndex - 1].path);
    }
  };

  const goRight = () => {
    if (activeIndex < visibleNavItems.length - 1) {
      navigate(visibleNavItems[activeIndex + 1].path);
    }
  };

  const currentLabel = visibleNavItems[activeIndex]?.label || "";

  return (
    <>
      {/* Left arrow */}
      {activeIndex > 0 && (
        <button
          onClick={goLeft}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-r-xl shadow-md active:bg-muted transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
      )}

      {/* Right arrow */}
      {activeIndex < visibleNavItems.length - 1 && (
        <button
          onClick={goRight}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 p-2 bg-card/80 backdrop-blur-sm border border-border rounded-l-xl shadow-md active:bg-muted transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5 text-foreground" />
        </button>
      )}

      {/* Bottom indicator bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
        <div className="flex items-center justify-center py-2.5 gap-3">
          {/* Dot indicators */}
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
          {/* Current page label */}
          <span className="text-xs font-medium text-foreground ml-1">
            {currentLabel}
          </span>
        </div>
      </nav>
    </>
  );
}
