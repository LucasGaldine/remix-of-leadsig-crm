import { useEffect, useState } from "react";
import { Briefcase, ExternalLink, Eye, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useWebsiteSettings,
  type WebsiteHiringAutoRejectSettings,
  type WebsiteHiringRole,
} from "@/hooks/useWebsiteSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_AUTO_REJECT_SETTINGS: Required<WebsiteHiringAutoRejectSettings> = {
  transportation_enabled: true,
  availability_enabled: true,
  pay_expectation_enabled: true,
};

function createEmptyRole(): WebsiteHiringRole {
  return {
    id: crypto.randomUUID(),
    title: "",
    status: "draft",
    location: "",
    employment_type: "",
    description: "",
    acceptable_hourly_pay_min: null,
    acceptable_hourly_pay_max: null,
    auto_reject: DEFAULT_AUTO_REJECT_SETTINGS,
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAutoRejectSettings(
  input: WebsiteHiringAutoRejectSettings | undefined,
): Required<WebsiteHiringAutoRejectSettings> {
  return {
    transportation_enabled: input?.transportation_enabled ?? true,
    availability_enabled: input?.availability_enabled ?? true,
    pay_expectation_enabled: input?.pay_expectation_enabled ?? true,
  };
}

type JobApplication = {
  id: string;
  role_id: string;
  role_title: string;
  full_name: string;
  phone_number: string;
  email: string;
  city: string;
  reliable_transportation: boolean;
  landscaping_or_labor_experience: "0" | "1–2" | "3+";
  available_full_time: boolean;
  expected_hourly_pay: string;
  why_hire_you: string;
  screening_tag: "Reject" | "Review" | "Qualified";
  screening_stage: "Pre-Screen Rejected" | "Pre-Screen Review" | "Pre-Screen Qualified";
  screening_reason: string | null;
  created_at: string;
};

function screeningTagClass(tag: JobApplication["screening_tag"]) {
  if (tag === "Reject") return "bg-red-100 text-red-700";
  if (tag === "Review") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function formatRoleUpdatedAt(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeRoleStatus(value: string | undefined): string {
  return value?.trim().length ? value : "Draft";
}

function normalizeRoleUrgency(value: string | undefined): "low" | "normal" | "high" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "low" || normalized === "high") return normalized;
  return "normal";
}

function urgencyBadgeClass(value: "low" | "normal" | "high"): string {
  if (value === "high") return "border-red-200 bg-red-100 text-red-700";
  if (value === "low") return "border-emerald-200 bg-emerald-100 text-emerald-700";
  return "border-sky-200 bg-sky-100 text-sky-700";
}

function statusBadgeClass(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "published" || normalized === "active") return "border-emerald-200 bg-emerald-100 text-emerald-700";
  if (normalized === "paused") return "border-amber-200 bg-amber-100 text-amber-700";
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

export default function Hiring() {
  const { currentAccount } = useAuth();
  const { websiteConfig, isLoading, updateWebsiteAsync, isSaving } = useWebsiteSettings();
  const [roles, setRoles] = useState<WebsiteHiringRole[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleMode, setEditingRoleMode] = useState<"create" | "edit" | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsModalRoleId, setApplicationsModalRoleId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    setRoles(websiteConfig.hiring_roles ?? []);
    setEditingRoleId(null);
    setEditingRoleMode(null);
    setIsDirty(false);
  }, [isLoading, websiteConfig]);

  useEffect(() => {
    const loadApplications = async () => {
      if (!currentAccount?.id) {
        setApplications([]);
        return;
      }

      setApplicationsLoading(true);
      try {
        const { data, error } = await supabase
          .from("job_applications")
          .select("*")
          .eq("account_id", currentAccount.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setApplications((data ?? []) as JobApplication[]);
      } catch {
        toast.error("Failed to load job applications");
      } finally {
        setApplicationsLoading(false);
      }
    };

    void loadApplications();
  }, [currentAccount?.id]);

  const updateRole = (id: string, updates: Partial<WebsiteHiringRole>) => {
    setRoles((current) => current.map((role) => (role.id === id ? { ...role, ...updates } : role)));
    setIsDirty(true);
  };

  const updateRoleAutoReject = (
    id: string,
    updates: Partial<WebsiteHiringAutoRejectSettings>,
  ) => {
    setRoles((current) =>
      current.map((role) =>
        role.id === id
          ? {
              ...role,
              auto_reject: {
                ...normalizeAutoRejectSettings(role.auto_reject),
                ...updates,
              },
            }
          : role,
      ),
    );
    setIsDirty(true);
  };

  const addRole = () => {
    const newRole = createEmptyRole();
    setRoles((current) => [...current, newRole]);
    setEditingRoleId(newRole.id);
    setEditingRoleMode("create");
    setIsDirty(true);
  };

  const removeRole = (id: string) => {
    setRoles((current) => current.filter((role) => role.id !== id));
    if (editingRoleId === id) {
      setEditingRoleId(null);
      setEditingRoleMode(null);
    }
    if (applicationsModalRoleId === id) {
      setApplicationsModalRoleId(null);
      setSelectedApplicationId(null);
    }
    setIsDirty(true);
  };

  const closeRoleDialog = () => {
    setEditingRoleId(null);
    setEditingRoleMode(null);
  };

  const handleSave = async (): Promise<boolean> => {
    const cleaned = roles
      .map((role) => ({
        ...role,
        title: role.title.trim(),
        location: role.location?.trim() || "",
        employment_type: role.employment_type?.trim() || "",
        description: role.description?.trim() || "",
        acceptable_hourly_pay_min:
          typeof role.acceptable_hourly_pay_min === "number" && Number.isFinite(role.acceptable_hourly_pay_min)
            ? role.acceptable_hourly_pay_min
            : null,
        acceptable_hourly_pay_max:
          typeof role.acceptable_hourly_pay_max === "number" && Number.isFinite(role.acceptable_hourly_pay_max)
            ? role.acceptable_hourly_pay_max
            : null,
        auto_reject: normalizeAutoRejectSettings(role.auto_reject),
      }))
      .filter((role) => role.title.length > 0);

    try {
      await updateWebsiteAsync({
        hiring_roles: cleaned,
      });
      setRoles(cleaned);
      setIsDirty(false);
      toast.success("Hiring roles updated");
      return true;
    } catch {
      toast.error("Failed to save hiring roles");
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const applicationsByRole = applications.reduce<Record<string, JobApplication[]>>((acc, application) => {
    const key = application.role_id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(application);
    return acc;
  }, {});
  const modalApplications = applicationsModalRoleId ? applicationsByRole[applicationsModalRoleId] ?? [] : [];
  const selectedApplication =
    modalApplications.find((application) => application.id === selectedApplicationId) ?? null;
  const editingRole = editingRoleId ? roles.find((role) => role.id === editingRoleId) ?? null : null;
  const editingAutoReject = editingRole
    ? normalizeAutoRejectSettings(editingRole.auto_reject)
    : DEFAULT_AUTO_REJECT_SETTINGS;
  const isCreatingRole = editingRoleMode === "create";

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="" hideTitle />

      <div className="mx-auto mt-4 max-w-[var(--content-max-width)] space-y-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Hiring</h2>
            <p className="text-sm text-muted-foreground">Add jobs you are currently hiring for.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" className="gap-2" asChild>
              <a href="https://hireflow.leadsig.ai/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Hireflow
              </a>
            </Button>
            <Button type="button" onClick={addRole} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </div>
        </div>
        {roles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No open roles yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[30%] min-w-[180px]">Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Applicants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => {
                  const statusLabel = normalizeRoleStatus(role.status);
                  const urgency = normalizeRoleUrgency(role.urgency);
                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="space-y-2">
                          <button
                            type="button"
                            className="w-full truncate text-left text-sm font-semibold leading-none hover:underline"
                            onClick={() => {
                              setEditingRoleId(role.id);
                              setEditingRoleMode("edit");
                            }}
                          >
                            {role.title?.trim() || "Untitled role"}
                          </button>
                          <p className="max-w-[22rem] truncate text-[11px] text-muted-foreground">
                            {role.description?.trim() || "Open role"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{role.employment_type?.trim() || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{role.location?.trim() || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={urgencyBadgeClass(urgency)}
                        >
                          {urgency[0].toUpperCase() + urgency.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(statusLabel)}
                        >
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {applicationsLoading ? (
                          <span className="text-sm font-semibold text-foreground">…</span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:bg-muted/60"
                            onClick={() => {
                              setApplicationsModalRoleId(role.id);
                              const firstApplicationId = applicationsByRole[role.id]?.[0]?.id ?? null;
                              setSelectedApplicationId(firstApplicationId);
                            }}
                            aria-label={`View applicants for ${role.title?.trim() || "this role"}`}
                          >
                            <span>{applicationsByRole[role.id]?.length ?? 0}</span>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={editingRole !== null} onOpenChange={(open) => {
        if (!open) {
          closeRoleDialog();
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreatingRole ? "Add Role" : "Edit Role"}</DialogTitle>
            <DialogDescription>
              {isCreatingRole
                ? "Add this job role’s listing details and pre-screening pay range."
                : "Update this job role’s listing details and pre-screening pay range."}
            </DialogDescription>
          </DialogHeader>

          {editingRole ? (
            <div className="space-y-4">
              {!isCreatingRole ? (
                <div className="flex items-start justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-muted-foreground"
                    onClick={() => removeRole(editingRole.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor={`role-title-${editingRole.id}`}>Job Title</Label>
                <Input
                  id={`role-title-${editingRole.id}`}
                  value={editingRole.title}
                  onChange={(e) => updateRole(editingRole.id, { title: e.target.value })}
                  placeholder="Senior Technician"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`role-location-${editingRole.id}`}>Location</Label>
                  <Input
                    id={`role-location-${editingRole.id}`}
                    value={editingRole.location || ""}
                    onChange={(e) => updateRole(editingRole.id, { location: e.target.value })}
                    placeholder="Tampa, FL"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`role-type-${editingRole.id}`}>Employment Type</Label>
                  <Input
                    id={`role-type-${editingRole.id}`}
                    value={editingRole.employment_type || ""}
                    onChange={(e) => updateRole(editingRole.id, { employment_type: e.target.value })}
                    placeholder="Full-time"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`role-description-${editingRole.id}`}>Description</Label>
                <Textarea
                  id={`role-description-${editingRole.id}`}
                  value={editingRole.description || ""}
                  onChange={(e) => updateRole(editingRole.id, { description: e.target.value })}
                  rows={4}
                  placeholder="Responsibilities, requirements, and what the candidate can expect."
                />
              </div>
              <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                <div>
                  <h3 className="text-sm font-semibold">Auto reject</h3>
                  <p className="text-xs text-muted-foreground">
                    Set which application answers affect pre-screening.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <div>
                    <Label htmlFor={`role-auto-transportation-${editingRole.id}`} className="font-medium">
                      Transportation
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      No reliable transportation &rarr; Reject, Pre-Screen Rejected.
                    </p>
                  </div>
                  <Switch
                    id={`role-auto-transportation-${editingRole.id}`}
                    checked={editingAutoReject.transportation_enabled}
                    onCheckedChange={(checked) =>
                      updateRoleAutoReject(editingRole.id, { transportation_enabled: checked })
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <div>
                    <Label htmlFor={`role-auto-availability-${editingRole.id}`} className="font-medium">
                      Availability
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Not available full-time &rarr; Reject, Pre-Screen Rejected.
                    </p>
                  </div>
                  <Switch
                    id={`role-auto-availability-${editingRole.id}`}
                    checked={editingAutoReject.availability_enabled}
                    onCheckedChange={(checked) =>
                      updateRoleAutoReject(editingRole.id, { availability_enabled: checked })
                    }
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Label htmlFor={`role-auto-pay-${editingRole.id}`} className="font-medium">
                        Pay expectation
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Above acceptable max &rarr; Review, Pre-Screen Review.
                      </p>
                    </div>
                    <Switch
                      id={`role-auto-pay-${editingRole.id}`}
                      checked={editingAutoReject.pay_expectation_enabled}
                      onCheckedChange={(checked) =>
                        updateRoleAutoReject(editingRole.id, { pay_expectation_enabled: checked })
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`role-pay-min-${editingRole.id}`}>Acceptable hourly pay min</Label>
                      <Input
                        id={`role-pay-min-${editingRole.id}`}
                        value={editingRole.acceptable_hourly_pay_min ?? ""}
                        onChange={(e) =>
                          updateRole(editingRole.id, { acceptable_hourly_pay_min: parseOptionalNumber(e.target.value) })
                        }
                        placeholder="18"
                        inputMode="decimal"
                        disabled={!editingAutoReject.pay_expectation_enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`role-pay-max-${editingRole.id}`}>Acceptable hourly pay max</Label>
                      <Input
                        id={`role-pay-max-${editingRole.id}`}
                        value={editingRole.acceptable_hourly_pay_max ?? ""}
                        onChange={(e) =>
                          updateRole(editingRole.id, { acceptable_hourly_pay_max: parseOptionalNumber(e.target.value) })
                        }
                        placeholder="35"
                        inputMode="decimal"
                        disabled={!editingAutoReject.pay_expectation_enabled}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {isCreatingRole ? (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    disabled={isSaving || !editingRole.title.trim()}
                    onClick={async () => {
                      const didSave = await handleSave();
                      if (didSave) {
                        closeRoleDialog();
                      }
                    }}
                  >
                    Complete
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={applicationsModalRoleId !== null} onOpenChange={(open) => {
        if (!open) {
          setApplicationsModalRoleId(null);
          setSelectedApplicationId(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Applications</DialogTitle>
            <DialogDescription>
              {applicationsModalRoleId
                ? `${applicationsByRole[applicationsModalRoleId]?.length ?? 0} application${(applicationsByRole[applicationsModalRoleId]?.length ?? 0) === 1 ? "" : "s"} for this role.`
                : "Role applications"}
            </DialogDescription>
          </DialogHeader>

          {applicationsLoading ? (
            <p className="text-sm text-muted-foreground">Loading applications...</p>
          ) : modalApplications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No applications submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3">
                {modalApplications.map((application) => (
                  <button
                    key={application.id}
                    type="button"
                    onClick={() => setSelectedApplicationId(application.id)}
                    className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                      selectedApplicationId === application.id ? "border-primary bg-muted/40" : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{application.full_name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${screeningTagClass(application.screening_tag)}`}>
                          {application.screening_tag}
                        </span>
                        <p className="text-xs text-muted-foreground">{new Date(application.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{application.email}</p>
                  </button>
                ))}
              </div>

              {selectedApplication ? (
                <div className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{selectedApplication.full_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${screeningTagClass(selectedApplication.screening_tag)}`}>
                      {selectedApplication.screening_tag}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                    <p>Stage: {selectedApplication.screening_stage}</p>
                    <p>Email: {selectedApplication.email}</p>
                    <p>Phone Number: {selectedApplication.phone_number}</p>
                    <p>City: {selectedApplication.city}</p>
                    <p>Reliable transportation: {selectedApplication.reliable_transportation ? "Yes" : "No"}</p>
                    <p>Experience: {selectedApplication.landscaping_or_labor_experience}</p>
                    <p>Available full-time: {selectedApplication.available_full_time ? "Yes" : "No"}</p>
                    <p>Expected hourly pay: {selectedApplication.expected_hourly_pay}</p>
                  </div>
                  {selectedApplication.screening_reason && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Screening reason:</span>{" "}
                      {selectedApplication.screening_reason}
                    </p>
                  )}
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Why should we hire you?</span>{" "}
                    {selectedApplication.why_hire_you}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select an application card to view full details.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
