import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Package, Truck, Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialListCard } from "@/components/materials/MaterialListCard";
import { SupplyOrderCard } from "@/components/materials/SupplyOrderCard";
import { cn } from "@/lib/utils";
import { MaterialList, SupplyOrder, Supplier } from "@/types/materials";
import { toast } from "sonner";

// Demo data
const demoMaterialLists: MaterialList[] = [
  {
    id: "ml-1",
    jobId: "job-1",
    jobName: "Johnson Patio Installation",
    templateType: "pavers",
    measurements: { totalSqFt: 400, paverType: "Cambridge Cobble", baseDepth: 6, edgingLength: 80 },
    wastageFactor: 10,
    items: [
      { id: "mi-1", name: "Cambridge Cobble Pavers", category: "surface", unit: "pallets", qty: 45, supplierCategory: "Masonry" },
      { id: "mi-2", name: "Crushed Stone Base", category: "base", unit: "tons", qty: 8, supplierCategory: "Aggregates" },
      { id: "mi-3", name: "Polymeric Sand", category: "accessories", unit: "bags", qty: 10, supplierCategory: "Masonry" },
      { id: "mi-4", name: "Edge Restraint", category: "accessories", unit: "ft", qty: 88, supplierCategory: "Masonry" },
      { id: "mi-5", name: "Landscape Fabric", category: "base", unit: "rolls", qty: 2, supplierCategory: "Landscape" },
    ],
    createdAt: "Jan 10",
    updatedAt: "Jan 10",
  },
  {
    id: "ml-2",
    jobId: "job-2",
    jobName: "Williams Pool Deck",
    templateType: "pavers",
    measurements: { totalSqFt: 600, paverType: "Travertine", baseDepth: 8, edgingLength: 120 },
    wastageFactor: 12,
    items: [
      { id: "mi-1", name: "Travertine Pavers", category: "surface", unit: "sq ft", qty: 672, supplierCategory: "Stone" },
      { id: "mi-2", name: "Concrete Base", category: "base", unit: "yards", qty: 15, supplierCategory: "Concrete" },
      { id: "mi-3", name: "Drainage Channel", category: "accessories", unit: "ft", qty: 40, supplierCategory: "Drainage" },
    ],
    createdAt: "Jan 8",
    updatedAt: "Jan 9",
  },
  {
    id: "ml-3",
    jobId: "job-3",
    jobName: "Garcia Deck Build",
    templateType: "decks",
    measurements: { deckLength: 20, deckWidth: 16, joistSpacing: 16, footingCount: 12 },
    wastageFactor: 15,
    items: [
      { id: "mi-1", name: "Composite Decking", category: "surface", unit: "boards", qty: 85, supplierCategory: "Lumber" },
      { id: "mi-2", name: "Pressure Treated Joists", category: "base", unit: "pieces", qty: 24, supplierCategory: "Lumber" },
      { id: "mi-3", name: "Concrete Footings", category: "base", unit: "bags", qty: 36, supplierCategory: "Concrete" },
      { id: "mi-4", name: "Deck Screws", category: "fasteners", unit: "boxes", qty: 8, supplierCategory: "Hardware" },
      { id: "mi-5", name: "Joist Hangers", category: "fasteners", unit: "pieces", qty: 48, supplierCategory: "Hardware" },
    ],
    createdAt: "Jan 5",
    updatedAt: "Jan 6",
  },
];

const demoSupplyOrders: SupplyOrder[] = [
  {
    id: "so-1",
    materialListId: "ml-1",
    jobId: "job-1",
    jobName: "Johnson Patio Installation",
    supplierId: "sup-1",
    supplierName: "ABC Masonry Supply",
    items: demoMaterialLists[0].items,
    status: "confirmed",
    deliveryDate: "Jan 12",
    deliveryTime: "7:00 AM - 9:00 AM",
    deliveryAddress: "1234 Oak Street, Springfield",
    createdAt: "Jan 10",
    sentAt: "Jan 10",
    confirmedAt: "Jan 10",
  },
  {
    id: "so-2",
    materialListId: "ml-2",
    jobId: "job-2",
    jobName: "Williams Pool Deck",
    supplierId: "sup-2",
    supplierName: "Premium Stone & Tile",
    items: demoMaterialLists[1].items,
    status: "sent",
    deliveryDate: "Jan 15",
    deliveryTime: "Morning",
    deliveryAddress: "890 Pine Road, Lakewood",
    createdAt: "Jan 9",
    sentAt: "Jan 9",
  },
  {
    id: "so-3",
    materialListId: "ml-3",
    jobId: "job-3",
    jobName: "Garcia Deck Build",
    supplierId: "sup-3",
    supplierName: "Builder's Lumber Co.",
    items: demoMaterialLists[2].items,
    status: "draft",
    deliveryAddress: "234 Cedar Lane, Oak Park",
    createdAt: "Jan 6",
  },
];

const demoSuppliers: Supplier[] = [
  { id: "sup-1", name: "ABC Masonry Supply", phone: "(555) 111-2222", email: "orders@abcmasonry.com", deliveryOptions: "Same-day, Next-day" },
  { id: "sup-2", name: "Premium Stone & Tile", phone: "(555) 333-4444", email: "sales@premiumstone.com", deliveryOptions: "2-3 business days" },
  { id: "sup-3", name: "Builder's Lumber Co.", phone: "(555) 555-6666", email: "orders@builderslumber.com", deliveryOptions: "Next-day, Will-call" },
  { id: "sup-4", name: "Concrete Plus", phone: "(555) 777-8888", email: "dispatch@concreteplus.com", deliveryOptions: "Same-day" },
];

type ActiveTab = "lists" | "orders" | "suppliers";

export default function Materials() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>("lists");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter logic
  const filteredLists = demoMaterialLists.filter(ml =>
    ml.jobName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = demoSupplyOrders.filter(so =>
    so.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    so.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = demoSuppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const pendingOrders = demoSupplyOrders.filter(o => o.status === "sent" || o.status === "draft").length;
  const confirmedOrders = demoSupplyOrders.filter(o => o.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Materials & Supply"
        subtitle={`${demoMaterialLists.length} active lists`}
      />

      {/* Summary Cards */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex-shrink-0 p-3 rounded-lg bg-[hsl(var(--status-paid-bg))] border border-[hsl(var(--status-paid))]/20 min-w-[120px]">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-[hsl(var(--status-paid))]" />
              <span className="text-2xs text-[hsl(var(--status-paid))]">Lists</span>
            </div>
            <p className="text-lg font-bold text-foreground">{demoMaterialLists.length}</p>
          </div>
          <div className="flex-shrink-0 p-3 rounded-lg bg-[hsl(var(--status-pending-bg))] border border-[hsl(var(--status-pending))]/20 min-w-[120px]">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-[hsl(var(--status-pending))]" />
              <span className="text-2xs text-[hsl(var(--status-pending))]">Pending</span>
            </div>
            <p className="text-lg font-bold text-foreground">{pendingOrders}</p>
          </div>
          <div className="flex-shrink-0 p-3 rounded-lg bg-[hsl(var(--status-confirmed-bg))] border border-[hsl(var(--status-confirmed))]/20 min-w-[120px]">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-[hsl(var(--status-confirmed))]" />
              <span className="text-2xs text-[hsl(var(--status-confirmed))]">Confirmed</span>
            </div>
            <p className="text-lg font-bold text-foreground">{confirmedOrders}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 overflow-x-auto scrollbar-hide">
        <div className="flex">
          {[
            { id: "lists" as const, label: "Material Lists", icon: Package },
            { id: "orders" as const, label: "Supply Orders", icon: Truck },
            { id: "suppliers" as const, label: "Suppliers", icon: Building2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap flex items-center gap-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Actions */}
      <div className="px-4 py-3 bg-card border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={`Search ${activeTab === "lists" ? "material lists" : activeTab === "orders" ? "orders" : "suppliers"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {activeTab === "lists" && (
            <Button className="flex-1 gap-2" onClick={() => navigate("/materials/lists/new")}>
              <Plus className="h-4 w-4" />
              Create Material List
            </Button>
          )}
          {activeTab === "orders" && (
            <Button className="flex-1 gap-2" onClick={() => navigate("/materials/orders/new")}>
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          )}
          {activeTab === "suppliers" && (
            <Button className="flex-1 gap-2" onClick={() => navigate("/materials/suppliers/new")}>
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="px-4 py-4">
        {activeTab === "lists" && (
          <div className="space-y-3">
            {filteredLists.map((list) => (
              <MaterialListCard
                key={list.id}
                materialList={list}
                onClick={() => navigate(`/materials/lists/${list.id}`)}
              />
            ))}
            {filteredLists.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No material lists found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <SupplyOrderCard
                key={order.id}
                order={order}
                onClick={() => navigate(`/materials/orders/${order.id}`)}
              />
            ))}
            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No orders found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "suppliers" && (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => toast.info(supplier.name, { description: `${supplier.phone} • ${supplier.email}` })}
                className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
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
            {filteredSuppliers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No suppliers found</p>
              </div>
            )}
          </div>
        )}
      </main>

      <FloatingActionButton
        actions={
          activeTab === "lists"
            ? [
                {
                  icon: <Package className="h-5 w-5" />,
                  label: "New Material List",
                  onClick: () => navigate("/materials/lists/new"),
                  primary: true,
                },
              ]
            : activeTab === "orders"
            ? [
                {
                  icon: <Truck className="h-5 w-5" />,
                  label: "New Supply Order",
                  onClick: () => navigate("/materials/orders/new"),
                  primary: true,
                },
              ]
            : [
                {
                  icon: <Building2 className="h-5 w-5" />,
                  label: "Add Supplier",
                  onClick: () => navigate("/materials/suppliers/new"),
                  primary: true,
                },
              ]
        }
      />

      <MobileNav />
    </div>
  );
}
