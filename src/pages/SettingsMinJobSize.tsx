import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SERVICE_TYPES } from "@/constants/serviceTypes";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function SettingsMinJobSize() {
  const navigate = useNavigate();
  const { currentAccount } = useAuth();
  const { settings, updateSettingsAsync, isSaving } = useAccountSettings();
  const defaultMap: Record<string, string> = SERVICE_TYPES.reduce((acc, type) => {
    acc[type] = "2500";
    return acc;
  }, {} as Record<string, string>);

  const [minimums, setMinimums] = useState<Record<string, string>>(
    SERVICE_TYPES.reduce((acc, type) => {
      acc[type] = defaultMap[type] ?? "";
      return acc;
    }, {} as Record<string, string>)
  );

  // Hydrate from existing settings when available
  useEffect(() => {
    if (settings?.min_job_size) {
      const merged: Record<string, string> = { ...minimums };
      SERVICE_TYPES.forEach((type) => {
        const existing = settings.min_job_size?.[type];
        if (existing != null) {
          merged[type] = String(existing);
        }
      });
      setMinimums(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.min_job_size]);

  const handleChange = (type: string, value: string) => {
    setMinimums((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleSave = () => {
    if (!currentAccount?.id) {
      toast.error("No account selected");
      return;
    }

    const payload = Object.fromEntries(
      Object.entries(minimums).map(([k, v]) => [k, Number(v) || 0])
    );

    updateSettingsAsync({ min_job_size: payload })
      .then(() => {
        toast.success("Minimum job sizes saved");
      })
      .catch((err: Error) => {
        toast.error(err.message);
      });
  };

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
              Minimum Job Size
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Set a floor amount for each service type
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Service Type Minimums
              </CardTitle>
              <CardDescription className="mt-1">
                Jobs can’t be created or scheduled below these amounts for their service type.
              </CardDescription>
            </div>
            <div className="sm:ml-auto">
              <Button onClick={handleSave} size="sm" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {SERVICE_TYPES.map((type) => (
              <div
                key={type}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-white dark:bg-slate-800"
              >
                <div className="flex-1">
                  <Label className="text-sm text-foreground">{type}</Label>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Minimum Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={minimums[type] ?? ""}
                      onChange={(e) => handleChange(type, e.target.value)}
                      placeholder="e.g., 2500"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button variant="outline" onClick={() => navigate("/settings")} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
