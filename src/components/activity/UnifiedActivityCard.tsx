import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export type ActivityTone = "neutral" | "confirmed" | "pending" | "attention";

interface UnifiedActivityCardProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  statusLabel: string;
  tone?: ActivityTone;
  mobileLayout?: "inbox" | "compact";
  onClick?: () => void;
  quickActions?: Array<{
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    showLabel?: boolean;
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
  }>;
  className?: string;
}

const toneClasses: Record<ActivityTone, { text: string; dot: string }> = {
  neutral: { text: "text-muted-foreground", dot: "bg-muted-foreground/50" },
  confirmed: { text: "text-[hsl(var(--status-confirmed))]", dot: "bg-[hsl(var(--status-confirmed))]" },
  pending: { text: "text-[hsl(var(--status-pending))]", dot: "bg-[hsl(var(--status-pending))]" },
  attention: { text: "text-[hsl(var(--status-attention))]", dot: "bg-[hsl(var(--status-attention))]" },
};

export function UnifiedActivityCard({
  icon,
  title,
  subtitle,
  statusLabel,
  tone = "neutral",
  mobileLayout = "inbox",
  onClick,
  quickActions = [],
  className,
}: UnifiedActivityCardProps) {
  const toneClass = toneClasses[tone];
  const hasQuickActions = quickActions.length > 0;

  const activityRowClasses =
    mobileLayout === "compact"
      ? "w-full border-t border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40 md:border-0 md:bg-transparent md:py-3"
      : "w-full border-t border-border bg-card px-4 py-8 transition-colors hover:bg-accent/40 md:border-0 md:bg-transparent md:py-3";

  if (hasQuickActions) {
    return (
      <div className={cn(activityRowClasses, "max-w-full", className)}>
        <div className="flex items-center justify-between gap-3">
          {onClick ? (
            <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <div className="mt-0.5 text-muted-foreground [&_svg]:h-7 [&_svg]:w-7 md:[&_svg]:h-5 md:[&_svg]:w-5">{icon}</div>
              <div className="min-w-0">
                <p className="truncate text-1 md:text-base">{title}</p>
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5 text-muted-foreground [&_svg]:h-7 [&_svg]:w-7 md:[&_svg]:h-5 md:[&_svg]:w-5">{icon}</div>
              <div className="min-w-0">
                <p className="truncate text-1 md:text-base">{title}</p>
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                variant={action.variant ?? "secondary"}
                size={action.size ?? "icon"}
                aria-label={action.label}
                title={action.label}
                className={cn((action.size ?? "icon") === "icon" && "h-8 w-8", action.className)}
              >
                {action.icon}
                {action.showLabel ? action.label : null}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(activityRowClasses, "text-left", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 text-muted-foreground [&_svg]:h-7 [&_svg]:w-7 md:[&_svg]:h-5 md:[&_svg]:w-5">{icon}</div>
          <div className="min-w-0">
            <p className="truncate text-1 md:text-base">{title}</p>
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className={cn("inline-flex items-center gap-2 text-base font-medium md:text-sm", toneClass.text)}>
          <span>{statusLabel}</span>
          <span className={cn("h-2.5 w-2.5 rounded-full", toneClass.dot)} />
        </div>
      </div>
    </button>
  );
}
