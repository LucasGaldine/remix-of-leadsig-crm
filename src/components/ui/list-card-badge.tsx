import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ListCardBadgeProps {
  icon: ReactNode;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function ListCardBadge({ icon, value, className, valueClassName }: ListCardBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-2 shrink-0", className)}>
      {icon}
      <span className={cn("whitespace-nowrap", valueClassName)}>{value}</span>
    </Badge>
  );
}
