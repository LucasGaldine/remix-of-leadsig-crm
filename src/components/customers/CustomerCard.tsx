import { Phone, MapPin, ChevronRight } from "lucide-react";

export interface CustomerCardData {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  reason?: string;
}

interface CustomerCardProps {
  customer: CustomerCardData;
  onClick: () => void;
}

export function CustomerCard({ customer, onClick }: CustomerCardProps) {
  const location = [customer.address, customer.city].filter(Boolean).join(", ");

  return (
    <button
      onClick={onClick}
      className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
          <div className="mt-1 space-y-0.5">
            {customer.phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {customer.phone}
              </p>
            )}
            {location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {location}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
      </div>
    </button>
  );
}
