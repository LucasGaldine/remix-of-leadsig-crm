import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";


{/*
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex-1 min-w-[140px] card-elevated rounded-lg p-4 text-left transition-all",
        onClick && "levitate",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex flex-col ">        

          <div className="flex items-center gap-4">
            <Icon className="w-4 h-4"></Icon>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>

          <p className="text-2xl leading-1 ml-8 font-bold text-foreground">{value}</p>
        

        </div>


        

    </button>*/}


interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex-1 min-w-[220px] card-elevated rounded-lg p-8 text-left transition-all",
        onClick && "levitate",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex">
          <div className="p-2 rounded-full bg-[hsl(var(--secondary))]">
            <Icon className="w-5 h-5 text-[hsl(var(--secondary-foreground))]" />
          </div>
        </div>

        <div className="gap-2">
          <p className="text-4xl font-bold">{value}</p>
          <p className="text-5">{label}</p>
        </div>
      </div>
    </button>
  );
}
