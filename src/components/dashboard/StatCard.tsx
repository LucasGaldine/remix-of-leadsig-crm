import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  onClick,
}: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex-1 min-w-[140px] card-elevated rounded-lg p-4 text-left transition-all",
        onClick && "hover:shadow-md active:scale-[0.98]",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "p-2 rounded-lg",
            variant === "default" && "bg-secondary text-secondary-foreground",
            variant === "success" && "bg-status-confirmed-bg text-status-confirmed",
            variant === "warning" && "bg-status-pending-bg text-status-pending",
            variant === "danger" && "bg-status-attention-bg text-status-attention"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </button>
  );
}
