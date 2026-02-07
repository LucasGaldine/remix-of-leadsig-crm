import { Truck, Phone, Mail, MapPin, Calendar, Package } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

// Demo data - will be replaced with real data
const demoOrders: Record<string, {
  id: string;
  jobName: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
  status: string;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryAddress: string;
  items: Array<{ name: string; qty: number; unit: string }>;
  notes?: string;
  createdAt: string;
}> = {
  "so-1": {
    id: "so-1",
    jobName: "Johnson Patio Installation",
    supplierName: "ABC Masonry Supply",
    supplierPhone: "(555) 111-2222",
    supplierEmail: "orders@abcmasonry.com",
    status: "confirmed",
    deliveryDate: "Jan 12",
    deliveryTime: "7:00 AM - 9:00 AM",
    deliveryAddress: "1234 Oak Street, Springfield",
    items: [
      { name: "Cambridge Cobble Pavers", qty: 45, unit: "pallets" },
      { name: "Crushed Stone Base", qty: 8, unit: "tons" },
      { name: "Polymeric Sand", qty: 10, unit: "bags" },
      { name: "Edge Restraint", qty: 88, unit: "ft" },
    ],
    createdAt: "Jan 10",
  },
  "so-2": {
    id: "so-2",
    jobName: "Williams Pool Deck",
    supplierName: "Premium Stone & Tile",
    supplierPhone: "(555) 333-4444",
    supplierEmail: "sales@premiumstone.com",
    status: "sent",
    deliveryDate: "Jan 15",
    deliveryTime: "Morning",
    deliveryAddress: "890 Pine Road, Lakewood",
    items: [
      { name: "Travertine Pavers", qty: 672, unit: "sq ft" },
      { name: "Concrete Base", qty: 15, unit: "yards" },
      { name: "Drainage Channel", qty: 40, unit: "ft" },
    ],
    createdAt: "Jan 9",
  },
  "so-3": {
    id: "so-3",
    jobName: "Garcia Deck Build",
    supplierName: "Builder's Lumber Co.",
    supplierPhone: "(555) 555-6666",
    supplierEmail: "orders@builderslumber.com",
    status: "draft",
    deliveryAddress: "234 Cedar Lane, Oak Park",
    items: [
      { name: "Composite Decking", qty: 85, unit: "boards" },
      { name: "Pressure Treated Joists", qty: 24, unit: "pieces" },
      { name: "Concrete Footings", qty: 36, unit: "bags" },
      { name: "Deck Screws", qty: 8, unit: "boxes" },
    ],
    createdAt: "Jan 6",
  },
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-status-pending-bg text-status-pending",
  confirmed: "bg-status-confirmed-bg text-status-confirmed",
  delivered: "bg-status-paid-bg text-status-paid",
};

export default function SupplyOrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const order = demoOrders[id || "so-1"];

  if (!order) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <Button onClick={() => navigate("/materials")}>Back to Materials</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Supply Order" showBack backTo="/materials" />

      <main className="px-4 py-4 space-y-4">
        {/* Order Header */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">{order.jobName}</h1>
              <p className="text-muted-foreground">{order.supplierName}</p>
            </div>
            <Badge className={cn("capitalize", statusColors[order.status])}>
              {order.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Created {order.createdAt}</p>
        </div>

        {/* Delivery Info */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Delivery Information</h2>
          
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Delivery Address</p>
              <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
            </div>
          </div>

          {order.deliveryDate && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Delivery Date</p>
                <p className="text-sm text-muted-foreground">
                  {order.deliveryDate} {order.deliveryTime && `• ${order.deliveryTime}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Supplier Contact */}
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Supplier Contact</h2>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 gap-2"
              onClick={() => window.open(`tel:${order.supplierPhone}`)}
            >
              <Phone className="h-4 w-4" />
              Call
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 gap-2"
              onClick={() => window.open(`mailto:${order.supplierEmail}`)}
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          </div>
        </div>

        {/* Items */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="font-semibold text-foreground mb-3">Order Items</h2>
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{item.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.qty} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {order.status === "draft" && (
            <Button className="w-full">Send to Supplier</Button>
          )}
          {order.status === "sent" && (
            <Button className="w-full">Mark as Confirmed</Button>
          )}
          {order.status === "confirmed" && (
            <Button className="w-full">Mark as Delivered</Button>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
