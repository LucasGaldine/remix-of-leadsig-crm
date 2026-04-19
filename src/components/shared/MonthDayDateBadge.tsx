import { format } from "date-fns";

import { cn } from "@/lib/utils";

interface MonthDayDateBadgeProps {
  date: Date;
  className?: string;
  monthClassName?: string;
  dayClassName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClassMap: Record<NonNullable<MonthDayDateBadgeProps["size"]>, string> = {
  sm: "h-12 w-12 rounded-xl",
  md: "h-14 w-14 rounded-2xl",
  lg: "h-20 w-20 rounded-3xl",
};

export function MonthDayDateBadge({
  date,
  className,
  monthClassName,
  dayClassName,
  size = "md",
}: MonthDayDateBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center border border-border bg-muted text-foreground",
        sizeClassMap[size],
        className,
      )}
    >
      <p className={cn("text-[10px] font-semibold leading-none tracking-wide", monthClassName)}>
        {format(date, "MMM").toUpperCase()}
      </p>
      <p className={cn("mt-1 text-1 font-semibold leading-none", dayClassName)}>
        {format(date, "d")}
      </p>
    </div>
  );
}
