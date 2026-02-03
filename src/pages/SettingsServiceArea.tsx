import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ServiceArea = {
  id: string;
  location: string;
  radiusMiles: string;
};

const defaultAreas: ServiceArea[] = [
  { id: "home-base", location: "Austin, TX", radiusMiles: "25" },
];

export default function SettingsServiceArea() {
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const { settings, updateSettingsAsync, isSaving } = useAccountSettings();
  const [areas, setAreas] = useState<ServiceArea[]>(defaultAreas);
  const [newArea, setNewArea] = useState<ServiceArea>({
    id: "new",
    location: "",
    radiusMiles: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateArea = (id: string, field: keyof ServiceArea, value: string) => {
    setAreas((prev) =>
      prev.map((area) => (area.id === id ? { ...area, [field]: value } : area))
    );
  };

  const removeArea = (id: string) => {
    setAreas((prev) => prev.filter((area) => area.id !== id));
  };

  const persistAreas = async (nextAreas: ServiceArea[]) => {
    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    const payload = nextAreas.map((a) => ({
      location: a.location,
      radius_miles: Number(a.radiusMiles) || 0,
      lat: null,
      lng: null,
    }));

    try {
      await updateSettingsAsync({ service_areas: payload });
      toast.success("Service areas saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save service areas");
    }
  };

  const addArea = () => {
    if (!newArea.location.trim()) return;
    const next = [
      ...areas,
      {
        id: `${newArea.location.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        location: newArea.location.trim(),
        radiusMiles: newArea.radiusMiles || "0"
      },
    ];
    setAreas(next);
    persistAreas(next);
    setNewArea({ id: "new", location: "", radiusMiles: "" });
  };

  const saveEdits = async () => {
    setEditingId(null);
    persistAreas(areas);
  };

  // Hydrate from settings
  useEffect(() => {
    if (settings?.service_areas && settings.service_areas.length > 0) {
      const hydrated = settings.service_areas.map((sa, idx) => ({
        id: `sa-${idx}-${sa.location}`,
        location: sa.location,
        radiusMiles: String(sa.radius_miles ?? 0),
      }));
      setAreas(hydrated);
    }
  }, [settings?.service_areas]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Service Area
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Add coverage locations and how far you’ll travel from each.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add a zone
              </CardTitle>
              <CardDescription className="mt-1">
                Each location defines a hub with its own travel radius in miles.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex-1 space-y-1">
                <Label className="text-sm">New Location</Label>
                <Input
                  value={newArea.location}
                    onChange={(e) => setNewArea((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Round Rock, TX"
                />
              </div>
                <div className="w-full sm:w-48 space-y-1">
                  <Label className="text-sm">Radius (miles)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newArea.radiusMiles}
                    onChange={(e) => setNewArea((prev) => ({ ...prev, radiusMiles: e.target.value }))}
                    placeholder="15"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addArea} className="w-full sm:w-auto" disabled={isSaving}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Add"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Coverage Zones
              </CardTitle>
            <CardDescription>Edit or remove existing coverage hubs. Changes save when you add, delete, or save edits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {areas.length === 0 && (
              <div className="text-sm text-muted-foreground">No locations added yet.</div>
            )}
            {areas.map((area) => (
              <div
                key={area.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-white dark:bg-slate-800"
              >
                <div className="flex-1 space-y-1">
                  <Label className="text-sm">Location / City</Label>
                  <Input
                    value={area.location}
                    onChange={(e) => updateArea(area.id, "location", e.target.value)}
                    placeholder="e.g., Austin, TX"
                    disabled={editingId !== area.id}
                  />
                </div>
                <div className="w-full sm:w-48 space-y-1">
                  <Label className="text-sm">Radius (miles)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={area.radiusMiles}
                    onChange={(e) => updateArea(area.id, "radiusMiles", e.target.value)}
                    placeholder="25"
                    disabled={editingId !== area.id}
                  />
                </div>
                {editingId === area.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdits} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(area.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="self-start sm:self-center"
                      onClick={() => {
                        const next = areas.filter((a) => a.id !== area.id);
                        setAreas(next);
                        persistAreas(next);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
