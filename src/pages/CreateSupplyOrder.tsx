import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Building2,
  Package,
  Truck,
  Calendar,
  Clock,
  MapPin,
  Send,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Supplier, MaterialList } from "@/types/materials";

// Demo suppliers
const suppliers: Supplier[] = [
  { id: "sup-1", name: "ABC Masonry Supply", phone: "(555) 111-2222", email: "orders@abcmasonry.com", deliveryOptions: "Same-day, Next-day" },
  { id: "sup-2", name: "Premium Stone & Tile", phone: "(555) 333-4444", email: "sales@premiumstone.com", deliveryOptions: "2-3 business days" },
  { id: "sup-3", name: "Builder's Lumber Co.", phone: "(555) 555-6666", email: "orders@builderslumber.com", deliveryOptions: "Next-day, Will-call" },
  { id: "sup-4", name: "Concrete Plus", phone: "(555) 777-8888", email: "dispatch@concreteplus.com", deliveryOptions: "Same-day" },
];

// Demo material lists
const materialLists: MaterialList[] = [
  {
    id: "ml-1",
    jobId: "job-1",
    jobName: "Johnson Patio Installation",
    templateType: "pavers",
    measurements: {},
    wastageFactor: 10,
    items: [
      { id: "mi-1", name: "Cambridge Cobble Pavers", category: "surface", unit: "pallets", qty: 45 },
      { id: "mi-2", name: "Crushed Stone Base", category: "base", unit: "tons", qty: 8 },
      { id: "mi-3", name: "Polymeric Sand", category: "accessories", unit: "bags", qty: 10 },
    ],
    createdAt: "Jan 10",
    updatedAt: "Jan 10",
  },
  {
    id: "ml-2",
    jobId: "job-2",
    jobName: "Williams Pool Deck",
    templateType: "pavers",
    measurements: {},
    wastageFactor: 12,
    items: [
      { id: "mi-1", name: "Travertine Pavers", category: "surface", unit: "sq ft", qty: 672 },
      { id: "mi-2", name: "Concrete Base", category: "base", unit: "yards", qty: 15 },
    ],
    createdAt: "Jan 8",
    updatedAt: "Jan 9",
  },
];

type Step = "list" | "supplier" | "delivery" | "confirm";

export default function CreateSupplyOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedList = location.state?.materialList as MaterialList | undefined;

  const [step, setStep] = useState<Step>(preselectedList ? "supplier" : "list");
  const [selectedList, setSelectedList] = useState<MaterialList | null>(preselectedList || null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("Morning");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const handleListSelect = (list: MaterialList) => {
    setSelectedList(list);
    setStep("supplier");
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setStep("delivery");
  };

  const handleCreateOrder = () => {
    setStep("confirm");
    setTimeout(() => {
      navigate("/materials", { state: { orderCreated: true } });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Create Supply Order" showBack />

      <main className="px-4 py-4">
        {/* Step 1: Select Material List */}
        {step === "list" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Select Material List</h2>
              <p className="text-sm text-muted-foreground">Choose which materials to order</p>
            </div>

            <div className="space-y-3">
              {materialLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleListSelect(list)}
                  className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <Package className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{list.jobName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {list.items.length} items
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Supplier */}
        {step === "supplier" && selectedList && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Select Supplier</h2>
              <p className="text-sm text-muted-foreground">{selectedList.jobName}</p>
            </div>

            <div className="space-y-3">
              {suppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  onClick={() => handleSupplierSelect(supplier)}
                  className={cn(
                    "w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all",
                    selectedSupplier?.id === supplier.id && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <Building2 className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{supplier.name}</h3>
                      <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                      {supplier.deliveryOptions && (
                        <p className="text-2xs text-muted-foreground mt-1">
                          Delivery: {supplier.deliveryOptions}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <Button variant="outline" className="w-full" onClick={() => setStep("list")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 3: Delivery Details */}
        {step === "delivery" && selectedList && selectedSupplier && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Delivery Details</h2>
              <p className="text-sm text-muted-foreground">
                {selectedList.jobName} • {selectedSupplier.name}
              </p>
            </div>

            {/* Order Summary */}
            <div className="card-elevated rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-3">Order Summary</h3>
              <div className="space-y-2">
                {selectedList.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="text-foreground">{item.qty} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Schedule */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Delivery Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Delivery Time Window</Label>
                <div className="flex gap-2">
                  {["Morning", "Afternoon", "All Day"].map((time) => (
                    <button
                      key={time}
                      onClick={() => setDeliveryTime(time)}
                      className={cn(
                        "flex-1 py-3 rounded-lg text-sm font-medium transition-colors",
                        deliveryTime === time
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Delivery Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="e.g., Gate code, specific drop location..."
                  rows={3}
                />
              </div>
            </div>

            {/* Delivery Address */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <MapPin className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Delivery Address</p>
                  <p className="text-sm text-muted-foreground">
                    Job site address will be pulled from job record
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("supplier")}>
                Back
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={handleCreateOrder}
                disabled={!deliveryDate}
              >
                <Send className="h-4 w-4" />
                Create Order
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === "confirm" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="p-4 rounded-full bg-[hsl(var(--status-confirmed-bg))] mb-4">
              <Check className="h-12 w-12 text-[hsl(var(--status-confirmed))]" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Order Created</h2>
            <p className="text-muted-foreground mb-1">
              Order sent to {selectedSupplier?.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Delivery scheduled for {deliveryDate} ({deliveryTime})
            </p>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
