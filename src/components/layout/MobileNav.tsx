import {
  LayoutDashboard,
  BarChart3,
  Magnet,
  Calendar,
  DollarSign,
  Settings,
  Inbox,
  Bug,
  Users,
  Ellipsis,
  ChevronDown,
  Globe,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePendingLeadsCount } from "@/hooks/usePendingLeads";
import { useEffect, useRef, useState, useCallback } from "react";
import { BugReportModal } from "@/components/layout/BugReportModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badgeKey?: string;
  requiredRole?: "manager" | "all";
}

interface NavGroup {
  label: string;
  requiredRole?: "manager" | "all";
  items: NavItem[];
}

const primaryNavItems: NavItem[] = [
  { icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard", path: "/", requiredRole: "all" },
  { icon: <Inbox className="h-5 w-5" />, label: "Inbox", path: "/inbox", requiredRole: "manager" },
  { icon: <Calendar className="h-5 w-5" />, label: "Calendar", path: "/schedule", requiredRole: "all" },
];

const moreMenuItems: NavItem[] = [
  { icon: <Globe className="h-5 w-5" />, label: "Website", path: "/website", requiredRole: "manager" },
  { icon: <Briefcase className="h-5 w-5" />, label: "Hiring", path: "/hiring", requiredRole: "manager" },
];

const moreMenuGroups: NavGroup[] = [
  {
    label: "CRM",
    requiredRole: "all",
    items: [
      { icon: <Users className="h-5 w-5" />, label: "Clients", path: "/customers", requiredRole: "all" },
      { icon: <Magnet className="h-5 w-5" />, label: "Leads", path: "/leads", requiredRole: "manager" },
      { icon: <Settings className="h-5 w-5" />, label: "Lead Sources", path: "/settings/lead-sources", requiredRole: "manager" },
    ],
  },
  {
    label: "Financials",
    requiredRole: "manager",
    items: [
      { icon: <DollarSign className="h-5 w-5" />, label: "Payments", path: "/payments", requiredRole: "manager" },
      { icon: <Settings className="h-5 w-5" />, label: "Pricing Rules", path: "/settings/pricing-rules", requiredRole: "manager" },
      { icon: <BarChart3 className="h-5 w-5" />, label: "Analytics", path: "/analytics", requiredRole: "manager" },
    ],
  },
];

const desktopFlyoutNavGroups: Array<NavGroup & { icon: React.ReactNode }> = [
  {
    label: "CRM",
    icon: <Users className="h-5 w-5" />,
    requiredRole: "all",
    items: [
      { icon: <Users className="h-5 w-5" />, label: "Clients", path: "/customers", requiredRole: "all" },
      { icon: <Magnet className="h-5 w-5" />, label: "Leads", path: "/leads", requiredRole: "manager" },
      { icon: <Settings className="h-5 w-5" />, label: "Lead Sources", path: "/settings/lead-sources", requiredRole: "manager" },
    ],
  },
  {
    label: "Financials",
    icon: <DollarSign className="h-5 w-5" />,
    requiredRole: "manager",
    items: [
      { icon: <DollarSign className="h-5 w-5" />, label: "Payments", path: "/payments", requiredRole: "manager" },
      { icon: <Settings className="h-5 w-5" />, label: "Pricing Rules", path: "/settings/pricing-rules", requiredRole: "manager" },
      { icon: <BarChart3 className="h-5 w-5" />, label: "Analytics", path: "/analytics", requiredRole: "manager" },
    ],
  },
];

const EDGE_ZONE = 40;
const SWIPE_THRESHOLD = 80;
const VERTICAL_RATIO = 1.5;
const DESKTOP_NAV_WIDTH_CLASS = "md:w-60";
const DESKTOP_NAV_OFFSET = "15rem";
const MOBILE_NAV_OFFSET = "5rem";
const DESKTOP_SECTION_OPEN_STORAGE_KEY = "mobile-nav:desktop-more-open";

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCrewMember } = useAuth();
  const { data: pendingLeadsCount = 0 } = usePendingLeadsCount();
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [desktopSectionOpen, setDesktopSectionOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const storedValue = window.localStorage.getItem(DESKTOP_SECTION_OPEN_STORAGE_KEY);
    if (storedValue === "true") return true;
    if (storedValue === "false") return false;
    return true;
  });

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isEdgeSwipe = useRef(false);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const badges: Record<string, number> = {
    pendingLeads: pendingLeadsCount,
  };

  const filterByRole = useCallback(
    (item: NavItem) => {
      if (!item.requiredRole || item.requiredRole === "all") return true;
      if (item.requiredRole === "manager") return !isCrewMember();
      return true;
    },
    [isCrewMember],
  );

  const visiblePrimaryNavItems = primaryNavItems.filter(filterByRole);
  const visibleMoreMenuItems = moreMenuItems.filter(filterByRole);
  const visibleMoreMenuGroups = moreMenuGroups
    .filter((group) => filterByRole({ icon: null, label: group.label, path: "", requiredRole: group.requiredRole }))
    .map((group) => ({
      ...group,
      items: group.items.filter(filterByRole),
    }))
    .filter((group) => group.items.length > 0);
  const visibleDesktopFlyoutGroups = desktopFlyoutNavGroups
    .filter((group) => filterByRole({ icon: null, label: group.label, path: "", requiredRole: group.requiredRole }))
    .map((group) => ({
      ...group,
      items: group.items.filter(filterByRole),
    }))
    .filter((group) => group.items.length > 0);

  const isActiveRoute = useCallback(
    (path: string) => {
      if (path === "/") return location.pathname === "/";
      return location.pathname.startsWith(path);
    },
    [location.pathname],
  );

  const moreIsActive =
    visibleMoreMenuItems.some((item) => isActiveRoute(item.path)) ||
    visibleMoreMenuGroups.some((group) => group.items.some((item) => isActiveRoute(item.path)));
  const settingsIsActive = isActiveRoute("/settings");

  const currentIndex = visiblePrimaryNavItems.findIndex((item) => isActiveRoute(item.path));
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  const resetSwipeState = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
    isEdgeSwipe.current = false;
    setSwipeOffset(0);
    setSwipeDirection(null);
  }, []);

  const handleSwipe = useCallback(() => {
    if (
      !isEdgeSwipe.current ||
      touchStartX.current === null ||
      touchEndX.current === null ||
      touchStartY.current === null ||
      touchEndY.current === null
    ) {
      resetSwipeState();
      return;
    }

    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = Math.abs(touchStartY.current - touchEndY.current);
    const absDistanceX = Math.abs(distanceX);

    if (absDistanceX < SWIPE_THRESHOLD || distanceY * VERTICAL_RATIO > absDistanceX) {
      resetSwipeState();
      return;
    }

    const isLeftSwipe = distanceX > 0;
    const isRightSwipe = distanceX < 0;

    if (isLeftSwipe && activeIndex < visiblePrimaryNavItems.length - 1) {
      navigate(visiblePrimaryNavItems[activeIndex + 1].path);
    }

    if (isRightSwipe && activeIndex > 0) {
      navigate(visiblePrimaryNavItems[activeIndex - 1].path);
    }

    resetSwipeState();
  }, [activeIndex, visiblePrimaryNavItems, navigate, resetSwipeState]);

  useEffect(() => {
    const screenWidth = window.innerWidth;

    const onTouchStart = (e: TouchEvent) => {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      touchStartX.current = x;
      touchStartY.current = y;
      touchEndX.current = null;
      touchEndY.current = null;

      const nearLeftEdge = x < EDGE_ZONE;
      const nearRightEdge = x > screenWidth - EDGE_ZONE;
      isEdgeSwipe.current = nearLeftEdge || nearRightEdge;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipe.current || touchStartX.current === null || touchStartY.current === null) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      touchEndX.current = currentX;
      touchEndY.current = currentY;

      const dx = currentX - touchStartX.current;
      const dy = Math.abs(currentY - touchStartY.current);
      const adx = Math.abs(dx);

      if (dy * VERTICAL_RATIO > adx) {
        setSwipeOffset(0);
        setSwipeDirection(null);
        return;
      }

      const canGoRight = activeIndex > 0;
      const canGoLeft = activeIndex < visiblePrimaryNavItems.length - 1;

      if ((dx > 0 && canGoRight) || (dx < 0 && canGoLeft)) {
        const clamped = Math.max(-SWIPE_THRESHOLD, Math.min(SWIPE_THRESHOLD, dx));
        setSwipeOffset(clamped);
        setSwipeDirection(dx > 0 ? "right" : "left");
      } else {
        setSwipeOffset(0);
        setSwipeDirection(null);
      }
    };

    const onTouchEnd = () => {
      handleSwipe();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeIndex, visiblePrimaryNavItems, handleSwipe]);

  useEffect(() => {
    const applyContentOffsets = () => {
      const isDesktop = window.innerWidth >= 768;
      document.body.style.paddingLeft = isDesktop ? DESKTOP_NAV_OFFSET : "";
      document.body.style.paddingBottom = isDesktop ? "" : MOBILE_NAV_OFFSET;
    };

    applyContentOffsets();
    window.addEventListener("resize", applyContentOffsets);

    return () => {
      window.removeEventListener("resize", applyContentOffsets);
      document.body.style.paddingLeft = "";
      document.body.style.paddingBottom = "";
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DESKTOP_SECTION_OPEN_STORAGE_KEY, String(desktopSectionOpen));
  }, [desktopSectionOpen]);

  const swipeProgress = Math.abs(swipeOffset) / SWIPE_THRESHOLD;
  const showIndicator = isEdgeSwipe.current && swipeProgress > 0.1;

  const targetLabel =
    swipeDirection === "left" && activeIndex < visiblePrimaryNavItems.length - 1
      ? visiblePrimaryNavItems[activeIndex + 1].label
      : swipeDirection === "right" && activeIndex > 0
        ? visiblePrimaryNavItems[activeIndex - 1].label
        : null;

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <>
      {showIndicator && targetLabel && (
        <div
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-[60] pointer-events-none transition-opacity duration-100 md:hidden",
            swipeDirection === "left" ? "right-0" : "left-0",
          )}
          style={{ opacity: swipeProgress }}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 bg-foreground/80 text-background backdrop-blur-sm",
              swipeDirection === "left" ? "rounded-l-full" : "rounded-r-full",
            )}
          >
            <span className="text-xs font-medium">{targetLabel}</span>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary navigation"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom md:top-0 md:bottom-0 md:left-0 md:right-auto md:h-screen md:border-t-0 md:border-r",
          DESKTOP_NAV_WIDTH_CLASS,
        )}
      >
        <div className="hidden h-full md:flex md:flex-col md:gap-3 md:px-3 md:pt-3 md:pb-3">
          <div className="shrink-0 px-1 py-1">
            <img src="/header_logo.png" alt="LeadSig logo" className="h-12 w-auto object-contain" />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-hide">
            {visiblePrimaryNavItems.map((item) => {
              const isActive = isActiveRoute(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors",
                    "active:bg-muted",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="relative shrink-0">{item.icon}</div>
                  <span className="flex-1 truncate">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              className="flex w-full items-center gap-2 px-1 py-1 text-muted-foreground hover:text-foreground"
              onClick={() => setDesktopSectionOpen((prev) => !prev)}
              aria-label="Toggle secondary navigation"
              aria-expanded={desktopSectionOpen}
            >
              <span className="h-px flex-1 bg-border" />
              <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 transition-transform", desktopSectionOpen && "rotate-180")} />
            </button>

            {desktopSectionOpen &&
              visibleMoreMenuItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors",
                    "active:bg-muted",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div className="relative shrink-0">{item.icon}</div>
                  <span className="flex-1 truncate">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="rounded-full bg-status-attention px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}

            {desktopSectionOpen &&
              visibleDesktopFlyoutGroups.map((group) => {
              const groupIsActive = group.items.some((item) => isActiveRoute(item.path));

              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors active:bg-muted",
                        groupIsActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-label={group.label}
                    >
                      <div className="relative shrink-0">{group.icon}</div>
                      <span className="flex-1 truncate">{group.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="right" sideOffset={10} collisionPadding={12} className="w-64">
                    {group.items.map((item) => {
                      const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

                      return (
                        <DropdownMenuItem key={item.path} onSelect={() => handleNavigate(item.path)} className="gap-3 px-4 py-3 text-sm">
                          {item.icon}
                          <span className="flex-1">{item.label}</span>
                          {badgeCount > 0 && (
                            <span className="rounded-full bg-status-attention px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              {badgeCount > 9 ? "9+" : badgeCount}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <button
              onClick={() => setBugReportOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted"
            >
              <Bug className="h-5 w-5 shrink-0" />
              <span className="flex-1 truncate">Report a Bug</span>
            </button>
            <button
              onClick={() => handleNavigate("/settings")}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors active:bg-muted",
                settingsIsActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span className="flex-1 truncate">Settings</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center md:hidden">
          <div className="flex w-full items-stretch justify-between px-2 pt-2 pb-2">
            {visiblePrimaryNavItems.map((item) => {
              const isActive = isActiveRoute(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn("relative flex flex-1 flex-col items-center justify-center gap-1 transition-all", "active:scale-95")}
                  aria-label={item.label}
                >
                  <div
                    className={cn(
                      "relative flex items-center justify-center rounded-full transition-all [&_svg]:!h-6 [&_svg]:!w-6",
                      isActive ? "bg-primary/10 text-primary h-12 w-12" : "text-muted-foreground h-10 w-10",
                    )}
                  >
                    {item.icon}
                  </div>
                  <span className={cn("text-sm leading-tight", isActive ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </button>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95"
                  aria-label="More"
                >
                  <div
                    className={cn(
                      "relative flex items-center justify-center gap-0.5 rounded-full px-3 transition-all [&_svg]:!h-6 [&_svg]:!w-6",
                      moreIsActive ? "bg-primary/10 text-primary h-12" : "text-muted-foreground h-10",
                    )}
                  >
                    <Ellipsis className="h-5 w-5" />
                    <ChevronDown className="h-4 w-4" />
                  </div>
                  <span className={cn("text-sm leading-tight", moreIsActive ? "text-primary font-semibold" : "text-muted-foreground")}>
                    More
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" sideOffset={12} collisionPadding={12} className="w-64">
                {visibleMoreMenuItems.map((item) => {
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

                  return (
                    <DropdownMenuItem key={item.path} onSelect={() => handleNavigate(item.path)} className="gap-3 px-4 py-4 text-base">
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="rounded-full bg-status-attention px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {visibleMoreMenuGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {group.label}
                    </div>
                    {group.items.map((item) => {
                      const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

                      return (
                        <DropdownMenuItem key={item.path} onSelect={() => handleNavigate(item.path)} className="gap-3 px-4 py-4 text-base">
                          {item.icon}
                          <span className="flex-1">{item.label}</span>
                          {badgeCount > 0 && (
                            <span className="rounded-full bg-status-attention px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              {badgeCount > 9 ? "9+" : badgeCount}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                ))}
                <div className="px-4 py-1" aria-hidden="true">
                  <Separator />
                </div>
                <DropdownMenuItem onSelect={() => handleNavigate("/settings")} className="gap-3 px-4 py-4 text-base">
                  <Settings className="h-5 w-5" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setBugReportOpen(true)} className="gap-3 px-4 py-4 text-base">
                  <Bug className="h-5 w-5" />
                  <span>Report a Bug</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
      <BugReportModal open={bugReportOpen} onOpenChange={setBugReportOpen} />
    </>
  );
}
