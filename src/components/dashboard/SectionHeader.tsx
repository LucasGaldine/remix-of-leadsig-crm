import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function SectionHeader({ title, count, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-2">{title}</h2>
        {count !== undefined && (
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-label">
            {count}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 active:text-primary/60 min-h-touch px-2"
        >
          {action.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
