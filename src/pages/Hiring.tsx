import { useEffect, useState } from "react";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useWebsiteSettings,
  type WebsiteHiringInterviewDayAvailability,
  type WebsiteHiringRole,
} from "@/hooks/useWebsiteSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function createEmptyRole(): WebsiteHiringRole {
  return {
    id: crypto.randomUUID(),
    title: "",
    location: "",
    employment_type: "",
    description: "",
    acceptable_hourly_pay_min: null,
    acceptable_hourly_pay_max: null,
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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

const INTERVIEW_DAYS: Array<{
  value: WebsiteHiringInterviewDayAvailability["day"];
  label: string;
}> = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
];

const TIME_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const period = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const minuteLabel = String(minute).padStart(2, "0");
      options.push({ value, label: `${hour12}:${minuteLabel} ${period}` });
    }
  }
  return options;
})();

const INTERVIEW_WINDOWS: Array<{ start: string; end: string; label: string }> = (() => {
  const windows: Array<{ start: string; end: string; label: string }> = [];

  const formatLabel = (value: string) => {
    const [rawHour, rawMinute] = value.split(":");
    const hour = Number.parseInt(rawHour, 10);
    const minute = Number.parseInt(rawMinute, 10);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  };

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      const start = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      let endHour = hour;
      let endMinute = minute + 15;
      if (endMinute >= 60) {
        endMinute = 0;
        endHour += 1;
      }
      const end = endHour >= 24
        ? "24:00"
        : `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
      windows.push({
        start,
        end,
        label: `${formatLabel(start)} - ${end === "24:00" ? "12:00 AM" : formatLabel(end)}`,
      });
    }
  }
  return windows;
})();

function buildInterviewWindowKey(start: string, end: string): string {
  return `${start}-${end}`;
}

const VALID_INTERVIEW_WINDOW_KEYS = new Set(
  INTERVIEW_WINDOWS.map((window) => buildInterviewWindowKey(window.start, window.end)),
);

function createDefaultInterviewAvailability(): WebsiteHiringInterviewDayAvailability[] {
  return INTERVIEW_DAYS.map((day) => ({ day: day.value, enabled: false, slots: [] }));
}

function normalizeInterviewAvailability(
  input: WebsiteHiringInterviewDayAvailability[] | undefined,
): WebsiteHiringInterviewDayAvailability[] {
  const defaultValue = createDefaultInterviewAvailability();
  if (!Array.isArray(input)) return defaultValue;

  return INTERVIEW_DAYS.map((day) => {
    const existing = input.find((entry) => entry.day === day.value);
    if (!existing) {
      return { day: day.value, enabled: false, slots: [] };
    }

    const safeSlots = Array.isArray(existing.slots)
      ? existing.slots
          .filter((slot) => VALID_INTERVIEW_WINDOW_KEYS.has(buildInterviewWindowKey(slot.start, slot.end)))
          .map((slot) => ({ id: slot.id || crypto.randomUUID(), start: slot.start, end: slot.end }))
      : [];

    return {
      day: day.value,
      enabled: safeSlots.length > 0,
      slots: safeSlots,
    };
  });
}

function sanitizeInterviewAvailability(
  input: WebsiteHiringInterviewDayAvailability[],
): WebsiteHiringInterviewDayAvailability[] {
  return INTERVIEW_DAYS.map((day) => {
    const existing = input.find((entry) => entry.day === day.value) ?? {
      day: day.value,
      enabled: false,
      slots: [],
    };
    const validSlots = existing.slots
      .filter((slot) => VALID_INTERVIEW_WINDOW_KEYS.has(buildInterviewWindowKey(slot.start, slot.end)))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((slot) => ({ id: slot.id || crypto.randomUUID(), start: slot.start, end: slot.end }));

    return {
      day: day.value,
      enabled: validSlots.length > 0,
      slots: validSlots,
    };
  });
}

export default function Hiring() {
  const { currentAccount } = useAuth();
  const { websiteConfig, isLoading, updateWebsiteAsync, isSaving } = useWebsiteSettings();
  const [roles, setRoles] = useState<WebsiteHiringRole[]>([]);
  const [interviewAvailability, setInterviewAvailability] = useState<WebsiteHiringInterviewDayAvailability[]>(createDefaultInterviewAvailability());
  const [isDirty, setIsDirty] = useState(false);
  const [expandedRoleIds, setExpandedRoleIds] = useState<Record<string, boolean>>({});
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsModalRoleId, setApplicationsModalRoleId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    setRoles(websiteConfig.hiring_roles ?? []);
    setInterviewAvailability(normalizeInterviewAvailability(websiteConfig.hiring_interview_availability));
    setExpandedRoleIds({});
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

  const addRole = () => {
    const newRole = createEmptyRole();
    setRoles((current) => [...current, newRole]);
    setExpandedRoleIds((current) => ({ ...current, [newRole.id]: true }));
    setIsDirty(true);
  };

  const removeRole = (id: string) => {
    setRoles((current) => current.filter((role) => role.id !== id));
    setExpandedRoleIds((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (applicationsModalRoleId === id) {
      setApplicationsModalRoleId(null);
      setSelectedApplicationId(null);
    }
    setIsDirty(true);
  };

  const toggleRoleExpanded = (id: string) => {
    setExpandedRoleIds((current) => ({ ...current, [id]: !current[id] }));
  };

  const updateInterviewDay = (
    day: WebsiteHiringInterviewDayAvailability["day"],
    update: (current: WebsiteHiringInterviewDayAvailability) => WebsiteHiringInterviewDayAvailability,
  ) => {
    setInterviewAvailability((current) =>
      current.map((entry) => (entry.day === day ? update(entry) : entry)),
    );
    setIsDirty(true);
  };

  const toggleInterviewWindow = (
    day: WebsiteHiringInterviewDayAvailability["day"],
    windowStart: string,
    windowEnd: string,
  ) => {
    updateInterviewDay(day, (current) => ({
      ...current,
      slots: current.slots.some(
        (slot) => slot.start === windowStart && slot.end === windowEnd,
      )
        ? current.slots.filter(
            (slot) => !(slot.start === windowStart && slot.end === windowEnd),
          )
        : [
            ...current.slots,
            {
              id: crypto.randomUUID(),
              start: windowStart,
              end: windowEnd,
            },
          ],
    }));
  };

  const handleSave = async () => {
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
      }))
      .filter((role) => role.title.length > 0);
    const cleanedInterviewAvailability = sanitizeInterviewAvailability(interviewAvailability);

    try {
      await updateWebsiteAsync({
        hiring_roles: cleaned,
        hiring_interview_availability: cleanedInterviewAvailability,
      });
      setRoles(cleaned);
      setInterviewAvailability(cleanedInterviewAvailability);
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{role.title?.trim() || "Untitled role"}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => toggleRoleExpanded(role.id)}
                        aria-label={expandedRoleIds[role.id] ? "Collapse role editor" : "Expand role editor"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setApplicationsModalRoleId(role.id);
                        setSelectedApplicationId(null);
                      }}
                      disabled={applicationsLoading}
                    >
                      View Applications ({applicationsByRole[role.id]?.length ?? 0})
                    </Button>
                  </div>

                  {expandedRoleIds[role.id] ? (
                    <>
                      <div className="flex items-start justify-end">
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
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`role-pay-min-${role.id}`}>Acceptable hourly pay min</Label>
                          <Input
                            id={`role-pay-min-${role.id}`}
                            value={role.acceptable_hourly_pay_min ?? ""}
                            onChange={(e) =>
                              updateRole(role.id, { acceptable_hourly_pay_min: parseOptionalNumber(e.target.value) })
                            }
                            placeholder="18"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`role-pay-max-${role.id}`}>Acceptable hourly pay max</Label>
                          <Input
                            id={`role-pay-max-${role.id}`}
                            value={role.acceptable_hourly_pay_max ?? ""}
                            onChange={(e) =>
                              updateRole(role.id, { acceptable_hourly_pay_max: parseOptionalNumber(e.target.value) })
                            }
                            placeholder="35"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Auto pre-screen rules: Transportation = No or Full-time = No → Reject. Expected pay above max
                        → Review. Otherwise → Qualified.
                      </p>
                    </>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview Availability</CardTitle>
            <CardDescription>
              Click each day’s time bar to toggle 15-minute interview slots.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {interviewAvailability.map((dayAvailability) => (
              <div key={dayAvailability.day} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {INTERVIEW_DAYS.find((day) => day.value === dayAvailability.day)?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dayAvailability.slots.length} selected
                  </p>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  One bar = full day timeline (12:00 AM to 12:00 AM) in 15-minute increments.
                </p>

                <div className="mt-3">
                  <div
                    className="grid h-9 overflow-hidden rounded-lg border border-border"
                    style={{ gridTemplateColumns: `repeat(${INTERVIEW_WINDOWS.length}, minmax(0, 1fr))` }}
                  >
                    {INTERVIEW_WINDOWS.map((window, index) => {
                      const selected = dayAvailability.slots.some(
                        (slot) => slot.start === window.start && slot.end === window.end,
                      );
                      return (
                        <button
                          key={`${dayAvailability.day}-${window.start}-${window.end}`}
                          type="button"
                          title={window.label}
                          aria-label={`Toggle ${window.label}`}
                          onClick={() => toggleInterviewWindow(dayAvailability.day, window.start, window.end)}
                          className={`h-full w-full border-r border-border/70 transition-colors last:border-r-0 ${
                            selected ? "bg-primary hover:bg-primary/90" : "bg-muted/30 hover:bg-muted/60"
                          } ${
                            index % 4 === 0 ? "border-l border-l-border/70" : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>12:00 AM</span>
                    <span>6:00 AM</span>
                    <span>12:00 PM</span>
                    <span>6:00 PM</span>
                    <span>12:00 AM</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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
