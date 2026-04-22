import { useEffect, useState } from "react";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWebsiteSettings, type WebsiteHiringRole } from "@/hooks/useWebsiteSettings";
import { toast } from "sonner";

function createEmptyRole(): WebsiteHiringRole {
  return {
    id: crypto.randomUUID(),
    title: "",
    location: "",
    employment_type: "",
    description: "",
  };
}

export default function Hiring() {
  const { websiteConfig, isLoading, updateWebsiteAsync, isSaving } = useWebsiteSettings();
  const [roles, setRoles] = useState<WebsiteHiringRole[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setRoles(websiteConfig.hiring_roles ?? []);
    setIsDirty(false);
  }, [isLoading, websiteConfig]);

  const updateRole = (id: string, updates: Partial<WebsiteHiringRole>) => {
    setRoles((current) => current.map((role) => (role.id === id ? { ...role, ...updates } : role)));
    setIsDirty(true);
  };

  const addRole = () => {
    setRoles((current) => [...current, createEmptyRole()]);
    setIsDirty(true);
  };

  const removeRole = (id: string) => {
    setRoles((current) => current.filter((role) => role.id !== id));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const cleaned = roles
      .map((role) => ({
        ...role,
        title: role.title.trim(),
        location: role.location?.trim() || "",
        employment_type: role.employment_type?.trim() || "",
        description: role.description?.trim() || "",
      }))
      .filter((role) => role.title.length > 0);

    try {
      await updateWebsiteAsync({ hiring_roles: cleaned });
      setRoles(cleaned);
      setIsDirty(false);
      toast.success("Hiring roles updated");
    } catch {
      toast.error("Failed to save hiring roles");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Hiring" subtitle="Manage open positions shown on your website careers page" />

      <div className="mx-auto max-w-[var(--content-max-width)] space-y-4 px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Open Roles</CardTitle>
              <CardDescription>Add jobs you are currently hiring for.</CardDescription>
            </div>
            <Button type="button" onClick={addRole} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {roles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
                <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No open roles yet.</p>
              </div>
            ) : (
              roles.map((role) => (
                <div key={role.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">Role</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-muted-foreground"
                      onClick={() => removeRole(role.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`role-title-${role.id}`}>Job Title</Label>
                    <Input
                      id={`role-title-${role.id}`}
                      value={role.title}
                      onChange={(e) => updateRole(role.id, { title: e.target.value })}
                      placeholder="Senior Technician"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`role-location-${role.id}`}>Location</Label>
                      <Input
                        id={`role-location-${role.id}`}
                        value={role.location || ""}
                        onChange={(e) => updateRole(role.id, { location: e.target.value })}
                        placeholder="Tampa, FL"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`role-type-${role.id}`}>Employment Type</Label>
                      <Input
                        id={`role-type-${role.id}`}
                        value={role.employment_type || ""}
                        onChange={(e) => updateRole(role.id, { employment_type: e.target.value })}
                        placeholder="Full-time"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`role-description-${role.id}`}>Description</Label>
                    <Textarea
                      id={`role-description-${role.id}`}
                      value={role.description || ""}
                      onChange={(e) => updateRole(role.id, { description: e.target.value })}
                      rows={4}
                      placeholder="Responsibilities, requirements, and what the candidate can expect."
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <StickyActionBar
        onSave={() => {
          if (!isDirty || isSaving) return;
          void handleSave();
        }}
        isSaving={isSaving}
        disabled={!isDirty}
      />

      <MobileNav />
    </div>
  );
}
