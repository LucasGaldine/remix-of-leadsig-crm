import { useState, useEffect } from "react";
import { GripVertical, Plus, X, LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { DASHBOARD_CARDS, getCardConfig } from "@/constants/dashboardCards";

const MAX_CARDS = 5;
const MIN_CARDS = 1;

export default function SettingsDashboard() {
  const { cards: savedCards, saveCards, isSaving } = useDashboardPreferences();
  const [selectedIds, setSelectedIds] = useState<string[]>(savedCards);
  const [isDirty, setIsDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const blocker = useUnsavedChanges(isDirty);

  useEffect(() => {
    setSelectedIds(savedCards);
  }, [savedCards]);

  const availableCards = DASHBOARD_CARDS.filter((c) => !selectedIds.includes(c.id));

  const addCard = (id: string) => {
    if (selectedIds.length >= MAX_CARDS) {
      toast.error(`Maximum ${MAX_CARDS} cards allowed`);
      return;
    }
    setSelectedIds((prev) => [...prev, id]);
    setIsDirty(true);
  };

  const removeCard = (id: string) => {
    if (selectedIds.length <= MIN_CARDS) {
      toast.error("You need at least one card on your dashboard");
      return;
    }
    setSelectedIds((prev) => prev.filter((c) => c !== id));
    setIsDirty(true);
  };

  const moveCard = (fromIndex: number, toIndex: number) => {
    setSelectedIds((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setIsDirty(true);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveCard(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleSave = async () => {
    const success = await saveCards(selectedIds);
    if (success) {
      setIsDirty(false);
      toast.success("Dashboard layout saved");
    } else {
      toast.error("Failed to save dashboard layout");
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Dashboard Layout" showBack backTo="/settings" showNotifications={false} />

      <main className="px-4 py-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Your Dashboard Cards
            </CardTitle>
            <CardDescription>
              Drag to reorder. You can display {MIN_CARDS}--{MAX_CARDS} stat cards at the top of your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedIds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No cards selected. Add some from below.
              </p>
            )}
            {selectedIds.map((id, index) => {
              const config = getCardConfig(id);
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-all",
                    dragIndex === index && "opacity-50 border-dashed"
                  )}
                >
                  <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="p-2 rounded-lg shrink-0 bg-secondary text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{config.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-status-attention"
                    onClick={() => removeCard(id)}
                    disabled={selectedIds.length <= MIN_CARDS}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {availableCards.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Available Cards
              </CardTitle>
              <CardDescription>
                Tap to add a card to your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableCards.map((config) => {
                const Icon = config.icon;
                const isDisabled = selectedIds.length >= MAX_CARDS;
                return (
                  <button
                    key={config.id}
                    onClick={() => addCard(config.id)}
                    disabled={isDisabled}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-left transition-all",
                      isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted/50 active:scale-[0.99] cursor-pointer"
                    )}
                  >
                    <div className="p-2 rounded-lg shrink-0 bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{config.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        <StickyActionBar onSave={handleSave} isSaving={isSaving} label="Save layout" />
      </main>

      <MobileNav />
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  );
}
