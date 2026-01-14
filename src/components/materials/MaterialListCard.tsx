import { Package, Ruler, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaterialList, TemplateType } from "@/types/materials";

interface MaterialListCardProps {
  materialList: MaterialList;
  onClick?: () => void;
}

const templateLabels: Record<TemplateType, string> = {
  pavers: "Pavers/Patio",
  concrete: "Concrete",
  sod: "Sod/Lawn",
  decks: "Deck",
  fencing: "Fencing",
};

const templateColors: Record<TemplateType, string> = {
  pavers: "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]",
  concrete: "bg-secondary text-secondary-foreground",
  sod: "bg-[hsl(var(--status-confirmed-bg))] text-[hsl(var(--status-confirmed))]",
  decks: "bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid))]",
  fencing: "bg-accent text-accent-foreground",
};

export function MaterialListCard({ materialList, onClick }: MaterialListCardProps) {
  const totalItems = materialList.items.length;
  const categories = [...new Set(materialList.items.map(i => i.category))];

  return (
    <button
      onClick={onClick}
      className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            <Package className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-2xs px-2 py-0.5 rounded-full", templateColors[materialList.templateType])}>
                {templateLabels[materialList.templateType]}
              </span>
            </div>
            <h3 className="font-semibold text-foreground">{materialList.jobName}</h3>
            <p className="text-sm text-muted-foreground">
              {totalItems} item{totalItems !== 1 ? 's' : ''} • {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
            </p>
            <p className="text-2xs text-muted-foreground mt-1 flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              {materialList.wastageFactor}% wastage factor
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {materialList.updatedAt}
          </p>
        </div>
      </div>
    </button>
  );
}
