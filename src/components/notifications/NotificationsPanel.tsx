import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  ArrowRightLeft,
  DollarSign,
  CalendarDays,
  FileCheck,
  BellOff,
  CheckCheck,
  Trash2,
  Briefcase,
} from "lucide-react";

interface NotificationsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVENT_CONFIG: Record<string, { icon: typeof UserPlus; color: string }> = {
  new_lead: { icon: UserPlus, color: "text-blue-600 bg-blue-50" },
  lead_status_change: { icon: ArrowRightLeft, color: "text-amber-600 bg-amber-50" },
  payment_received: { icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
  schedule_change: { icon: CalendarDays, color: "text-sky-600 bg-sky-50" },
  estimate_approved: { icon: FileCheck, color: "text-teal-600 bg-teal-50" },
  job_assignment: { icon: Briefcase, color: "text-primary bg-primary/10" },
};

function getRoute(notification: Notification): string | null {
  if (!notification.reference_id) return null;
  switch (notification.reference_type) {
    case "lead":
      return `/leads/${notification.reference_id}`;
    case "payment":
      return `/payments/${notification.reference_id}`;
    case "estimate":
      return `/payments/estimates/${notification.reference_id}`;
    case "job_schedule":
      return `/jobs/${notification.reference_id}`;
    default:
      return null;
  }
}

function NotificationItem({
  notification,
  onNavigate,
  onMarkRead,
}: {
  notification: Notification;
  onNavigate: (path: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const config = EVENT_CONFIG[notification.event_type] || EVENT_CONFIG.new_lead;
  const Icon = config.icon;
  const route = getRoute(notification);

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id);
    if (route) onNavigate(route);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
        "hover:bg-muted/50 active:bg-muted",
        !notification.is_read && "bg-muted/30"
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium", !notification.is_read && "text-foreground", notification.is_read && "text-muted-foreground")}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

export function NotificationsPanel({ open, onOpenChange }: NotificationsPanelProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteAll, isDeletingAll } = useNotifications();

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle>Notifications</SheetTitle>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead()}
                  className="text-xs h-8 gap-1.5"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAll()}
                  disabled={isDeletingAll}
                  className="text-xs h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete all
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BellOff className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">Activity will show up here</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onNavigate={handleNavigate}
                  onMarkRead={markAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
