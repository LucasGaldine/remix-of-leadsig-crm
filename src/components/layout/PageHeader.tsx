import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { GlobalSearch } from "./GlobalSearch";
import { useNotifications } from "@/hooks/useNotifications";
import { OPEN_GLOBAL_SEARCH_EVENT } from "@/lib/keyboardShortcuts";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  showNotifications?: boolean;
  showSearch?: boolean;
  onSearchClick?: () => void;
  notificationCount?: number;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  showBack,
  backTo,
  showNotifications = true,
  showSearch = true,
  onSearchClick,
  actions,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleSearchClick = useCallback(() => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      setSearchOpen(true);
    }
  }, [onSearchClick]);

  const handleBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    if (!showSearch) return;

    const openSearch = () => {
      handleSearchClick();
    };

    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, openSearch);
    return () => {
      window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, openSearch);
    };
  }, [handleSearchClick, showSearch]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/header_logo.png"
              alt="Header logo"
              className="h-12 w-auto object-cover shrink-0"
            />
            {showBack && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-1">{title}</h1>
              {subtitle && (
                <p className="text-5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actions}
            {showSearch && (
              <button
                onClick={handleSearchClick}
                className="p-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
            {showNotifications && (
              <button
                onClick={() => setPanelOpen(true)}
                className="relative p-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </button>
            )}
            <UserMenu />
          </div>
        </div>

      </header>

      {showNotifications && (
        <NotificationsPanel open={panelOpen} onOpenChange={setPanelOpen} />
      )}

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
