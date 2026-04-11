import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, cardVariants } from "@/components/ui/card";

export type ActivityTone = "neutral" | "confirmed" | "pending" | "attention";

interface UnifiedActivityCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  statusLabel: string;
  tone?: ActivityTone;
  onClick?: () => void;
  quickActions?: Array<{
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
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
  onClick,
  quickActions = [],
  className,
}: UnifiedActivityCardProps) {
  const toneClass = toneClasses[tone];
  const hasQuickActions = quickActions.length > 0;

  if (hasQuickActions) {
    return (
      <Card variant="activity" className={cn("w-full max-w-full", className)}>
        <div className="flex items-center justify-between gap-3">
          {onClick ? (
            <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <div className="mt-0.5 text-muted-foreground">{icon}</div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{title}</p>
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">{icon}</div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{title}</p>
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
                variant="secondary"
                size="icon"
                aria-label={action.label}
                title={action.label}
                className="h-8 w-8"
              >
                {action.icon}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cardVariants({ variant: "activity" }), "w-full text-left", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 text-muted-foreground">{icon}</div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{title}</p>
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className={cn("inline-flex items-center gap-2 text-sm font-medium", toneClass.text)}>
          <span>{statusLabel}</span>
          <span className={cn("h-2.5 w-2.5 rounded-full", toneClass.dot)} />
        </div>
      </div>
    </button>
  );
}
