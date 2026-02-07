import { useState } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { useNotifications } from "@/hooks/useNotifications";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  showNotifications?: boolean;
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
  actions,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

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
            {showBack && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actions}
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
    </>
  );
}
