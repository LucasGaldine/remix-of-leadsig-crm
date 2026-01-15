import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
  {
    variants: {
      status: {
        confirmed: "status-confirmed",
        pending: "status-pending",
        attention: "status-attention",
        paid: "status-paid",
        scheduled: "status-confirmed",
        "in-progress": "status-progress",
        in_progress: "status-progress",
        completed: "status-paid",
        invoiced: "status-pending",
        won: "status-won",
      },
      size: {
        sm: "text-2xs px-2 py-0.5",
        default: "text-xs px-3 py-1",
        lg: "text-sm px-4 py-1.5",
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
  return (
    <span
      className={cn(
        statusBadgeVariants({ status, size }),
        pulse && "animate-pulse-status",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "confirmed" && "bg-status-confirmed",
          status === "scheduled" && "bg-status-confirmed",
          status === "pending" && "bg-status-pending",
          status === "in-progress" && "bg-status-progress",
          status === "in_progress" && "bg-status-progress",
          status === "invoiced" && "bg-status-pending",
          status === "attention" && "bg-status-attention",
          status === "paid" && "bg-status-paid",
          status === "completed" && "bg-status-paid",
          status === "won" && "bg-status-won"
        )}
      />
      {children}
    </span>
  );
}
