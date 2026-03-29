import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        confirmed: "status-confirmed border-[hsl(var(--status-confirmed))]/40",
        pending: "status-pending border-[hsl(var(--status-pending))]/40",
        attention: "status-attention border-[hsl(var(--status-attention))]/40",
        unscheduled: "status-attention border-[hsl(var(--status-attention))]/40",
        scheduled: "status-confirmed border-[hsl(var(--status-confirmed))]/40",
        "in-progress": "status-progress border-[hsl(var(--status-progress))]/40",
        in_progress: "status-progress border-[hsl(var(--status-progress))]/40",
        completed: "status-paid border-[hsl(var(--status-paid))]/40",
        job: "status-confirmed border-[hsl(var(--status-confirmed))]/40",
        overdue: "status-attention border-[hsl(var(--status-attention))]/40",
        unassigned: "status-attention border-[hsl(var(--status-attention))]/40",
        needs_invoice: "status-attention border-[hsl(var(--status-attention))]/40",
      },
      size: {
        sm: "text-2xs px-2 py-0.5",
        default: "text-xs px-2.5 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  pulse?: boolean;
}

export function StatusBadge({
  className,
  status,
  size,
  pulse,
  children,
  ...props
}: StatusBadgeProps) {
  const isWarningStatus =
    status === "overdue" || status === "unassigned" || status === "needs_invoice";

  return (
    <span
      className={cn(
        statusBadgeVariants({ status, size }),
        pulse && "animate-pulse-status",
        className
      )}
      {...props}
    >
      {isWarningStatus ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Circle className="h-3 w-3 fill-current" />
      )}
      {children}
    </span>
  );
}
