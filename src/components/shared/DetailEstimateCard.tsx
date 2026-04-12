import { FileText } from "lucide-react";

interface DetailEstimateCardProps {
  label: string;
  status: string;
  total: number;
  lineItemCount: number;
  showStartingAt?: boolean;
  onClick: () => void;
  variant?: "card" | "plain";
}

export function DetailEstimateCard({
  label,
  status,
  total,
  lineItemCount,
  showStartingAt = false,
  onClick,
  variant = "card",
}: DetailEstimateCardProps) {
  return (
    <button
      onClick={onClick}
      className={
        variant === "plain"
          ? "w-full text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          : "w-full rounded-2xl border border-border bg-card p-5 text-left text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))]"
      }
    >
      <div className="flex items-center justify-between text-muted-foreground gap-1 flex-wrap">
        <div className="flex gap-2 items-center">
        <FileText className="w-3 h-3 "/>
        <p className="text-xs uppercase tracking-wide">{label}</p>
        </div>
        {status === "draft" ? 
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-tight">
          Draft
        </span> : <></>
}

      </div>

      <div className="mt-2">
        {showStartingAt ? (
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Starting at</p>
        ) : null}
        <p className="text-xl font-semibold leading-tight text-foreground">
          {Number(total).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="mt-2 text-muted-foreground text-xs">
          {lineItemCount} {lineItemCount === 1 ? "line item" : "line items"}
        </p>
      </div>

      <div className="mt-6">
        <div className="w-full rounded-full bg-muted px-5 py-3 text-center font-semibold whitespace-nowrap text-foreground text-sm">
          View Details
        </div>
      </div>
    </button>
  );
}
