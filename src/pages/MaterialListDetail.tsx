import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Package,
  Truck,
  Download,
  Edit,
  Trash2,
  Plus,
  Ruler,
  ChevronRight,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MaterialList, MaterialItem, TemplateType } from "@/types/materials";

// Demo material list data
const materialListData: MaterialList = {
  id: "ml-1",
  jobId: "job-1",
  jobName: "Johnson Patio Installation",
  templateType: "pavers",
  measurements: {
    totalSqFt: 400,
    paverType: "Cambridge Cobble",
    paverSize: '6"x9"',
    baseDepth: 6,
    edgingLength: 80,
    jointSandType: "Polymeric",
  },
  wastageFactor: 10,
  items: [
    { id: "mi-1", name: "Cambridge Cobble Pavers", category: "surface", unit: "pallets", qty: 45, notes: "Chestnut/Brown blend", supplierCategory: "Masonry" },
    { id: "mi-2", name: "Crushed Stone Base (3/4\")", category: "base", unit: "tons", qty: 8, supplierCategory: "Aggregates" },
    { id: "mi-3", name: "Stone Dust Leveling", category: "base", unit: "tons", qty: 2, supplierCategory: "Aggregates" },
    { id: "mi-4", name: "Landscape Fabric", category: "base", unit: "rolls", qty: 2, notes: "4ft x 100ft rolls", supplierCategory: "Landscape" },
    { id: "mi-5", name: "Polymeric Sand", category: "accessories", unit: "bags", qty: 10, notes: "50lb bags", supplierCategory: "Masonry" },
    { id: "mi-6", name: "Aluminum Edge Restraint", category: "accessories", unit: "ft", qty: 88, notes: "Includes 10% waste", supplierCategory: "Masonry" },
    { id: "mi-7", name: "10\" Spikes", category: "fasteners", unit: "box", qty: 2, notes: "For edge restraint", supplierCategory: "Hardware" },
  ],
  createdAt: "Jan 10, 2025",
  updatedAt: "Jan 10, 2025",
};

const templateLabels: Record<TemplateType, string> = {
  pavers: "Pavers/Patio",
  concrete: "Concrete",
  sod: "Sod/Lawn",
  decks: "Deck",
  fencing: "Fencing",
};

const categoryOrder = ["base", "surface", "accessories", "fasteners", "other"] as const;
const categoryLabels: Record<string, string> = {
  base: "Base Materials",
  surface: "Surface Materials",
  accessories: "Accessories",
  fasteners: "Fasteners & Hardware",
  other: "Other",
};

export default function MaterialListDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [materialList] = useState(materialListData);

  // Group items by category
  const groupedItems = categoryOrder.reduce((acc, category) => {
    const items = materialList.items.filter(item => item.category === category);
    if (items.length > 0) {
      acc[category] = items;
    }
    return acc;
  }, {} as Record<string, MaterialItem[]>);

  const handleCreateOrder = () => {
    navigate("/materials/orders/new", { state: { materialList } });
  };

  const handleExportPDF = () => {
    if (import.meta.env.DEV) {
      console.log("Exporting to PDF...");
    }
  };

  const handleExportCSV = () => {
    if (import.meta.env.DEV) {
      console.log("Exporting to CSV...");
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-32">
      <PageHeader title="Material List" showBack backTo="/materials" />

      {/* Header Info */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="text-2xs px-2 py-0.5 rounded-full bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]">
              {templateLabels[materialList.templateType]}
            </span>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {materialList.jobName}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            {materialList.items.length} items
          </span>
          <span className="flex items-center gap-1">
            <Ruler className="h-4 w-4" />
            {materialList.wastageFactor}% wastage
          </span>
        </div>
      </div>

      {/* Measurements Summary */}
      <div className="px-4 py-4">
        <h3 className="font-semibold text-foreground mb-3">Measurements</h3>
        <div className="card-elevated rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(materialList.measurements).map(([key, value]) => (
              <div key={key}>
                <p className="text-2xs text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="font-medium text-foreground">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Materials by Category */}
      <div className="px-4 space-y-4">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category}>
            <h3 className="font-semibold text-foreground mb-3">
              {categoryLabels[category] || category}
            </h3>
            <div className="card-elevated rounded-lg overflow-hidden">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-4",
                    index < items.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.notes && (
                        <p className="text-sm text-muted-foreground mt-0.5">{item.notes}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-foreground">
                        {item.qty} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleExportPDF}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleExportCSV}>
            <FileText className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <Button className="w-full h-14 text-base font-semibold gap-2" onClick={handleCreateOrder}>
          <Truck className="h-5 w-5" />
          Create Supplier Order
        </Button>
      </div>

      <MobileNav />
    </div>
  );
}
