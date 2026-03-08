import { Truck, Clock, Check, Send, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupplyOrder, SupplyOrderStatus } from "@/types/materials";

interface SupplyOrderCardProps {
  order: SupplyOrder;
  onClick?: () => void;
}

const statusConfig: Record<SupplyOrderStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground", icon: <Package className="h-3 w-3" /> },
  sent: { label: "Sent", className: "status-pending", icon: <Send className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", className: "status-paid", icon: <Check className="h-3 w-3" /> },
  delivered: { label: "Delivered", className: "status-confirmed", icon: <Truck className="h-3 w-3" /> },
};

export function SupplyOrderCard({ order, onClick }: SupplyOrderCardProps) {
  const config = statusConfig[order.status];

  return (
    <button
      onClick={onClick}
      className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            <Truck className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-2xs px-2 py-0.5 rounded-full inline-flex items-center gap-1", config.className)}>
                {config.icon}
                {config.label}
              </span>
            </div>
            <h3 className="font-semibold text-foreground">{order.jobName}</h3>
            <p className="text-sm text-muted-foreground">{order.supplierName}</p>
            <p className="text-2xs text-muted-foreground mt-1">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          {order.deliveryDate && (
            <div>
              <p className="text-sm font-medium text-foreground">{order.deliveryDate}</p>
              {order.deliveryTime && (
                <p className="text-2xs text-muted-foreground">{order.deliveryTime}</p>
              )}
            </div>
          )}
          <p className="text-2xs text-muted-foreground mt-1">
            {order.createdAt}
          </p>
        </div>
      </div>
    </button>
  );
}
