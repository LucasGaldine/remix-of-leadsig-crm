import { User } from "lucide-react";
import { UnifiedActivityCard } from "@/components/activity/UnifiedActivityCard";

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
  className?: string;
}

export function CustomerCard({ customer, onClick, className }: CustomerCardProps) {
  const location = [customer.address, customer.city].filter(Boolean).join(", ");
  const subtitle = `${customer.phone || "No phone"} | ${location || "No address"}`;

  return (
    <UnifiedActivityCard
      icon={<User className="h-5 w-5 text-sky-600" />}
      title={customer.name}
      subtitle={subtitle}
      statusLabel="Contact"
      tone="neutral"
      onClick={onClick}
      className={className}
    />
  );
}
