import { useEffect, useState } from "react";
import { Briefcase, Clock, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StickyActionBar } from "@/components/settings/StickyActionBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useWebsiteSettings,
  type WebsiteHiringAutoRejectSettings,
  type WebsiteHiringInterviewDayAvailability,
  type WebsiteHiringInterviewRules,
  type WebsiteHiringInterviewSlot,
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

const END_TIME_OPTIONS = [
  ...TIME_OPTIONS.slice(1),
  { value: "24:00", label: "12:00 AM" },
];

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

const WEEKDAY_DAYS: WebsiteHiringInterviewDayAvailability["day"][] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

const INTERVIEW_PRESETS = [
  { id: "weekdays-9-5", label: "Weekdays, 9 AM-5 PM", start: "09:00", end: "17:00" },
  { id: "weekdays-8-4", label: "Weekdays, 8 AM-4 PM", start: "08:00", end: "16:00" },
  { id: "weekdays-7-3", label: "Weekdays, 7 AM-3 PM", start: "07:00", end: "15:00" },
] as const;

const DEFAULT_INTERVIEW_RULES: Required<WebsiteHiringInterviewRules> = {
  interview_length_minutes: 30,
  buffer_time_minutes: 15,
  minimum_notice_hours: 24,
  booking_window_days: 14,
  block_when_job_scheduled: true,
};

type InterviewWindowDraft = {
  id: string;
  start: string;
  end: string;
};

function createDefaultInterviewAvailability(): WebsiteHiringInterviewDayAvailability[] {
  return INTERVIEW_DAYS.map((day) => ({ day: day.value, enabled: false, slots: [] }));
}

function timeToMinutes(value: string): number {
  if (value === "24:00") return 24 * 60;
  const [rawHour, rawMinute] = value.split(":");
  return Number.parseInt(rawHour, 10) * 60 + Number.parseInt(rawMinute, 10);
}

function getTimeLabel(value: string): string {
  if (value === "24:00") return "12:00 AM";
  return TIME_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getNextEndTime(start: string): string {
  const nextMinutes = Math.min(timeToMinutes(start) + 15, 24 * 60);
  return nextMinutes >= 24 * 60
    ? "24:00"
    : `${String(Math.floor(nextMinutes / 60)).padStart(2, "0")}:${String(nextMinutes % 60).padStart(2, "0")}`;
}

function buildSlotsFromWindow(start: string, end: string): WebsiteHiringInterviewSlot[] {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (endMinutes <= startMinutes) return [];

  const slots: WebsiteHiringInterviewSlot[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += 15) {
    const nextMinutes = minutes + 15;
    const slotStart = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const slotEnd = nextMinutes >= 24 * 60
      ? "24:00"
      : `${String(Math.floor(nextMinutes / 60)).padStart(2, "0")}:${String(nextMinutes % 60).padStart(2, "0")}`;
    slots.push({ id: crypto.randomUUID(), start: slotStart, end: slotEnd });
  }
  return slots;
}

function buildSlotsFromWindows(windows: InterviewWindowDraft[]): WebsiteHiringInterviewSlot[] {
  return windows.flatMap((window) => buildSlotsFromWindow(window.start, window.end));
}

function getWindowsFromSlots(slots: WebsiteHiringInterviewSlot[]): InterviewWindowDraft[] {
  const ordered = [...slots]
    .filter((slot) => VALID_INTERVIEW_WINDOW_KEYS.has(buildInterviewWindowKey(slot.start, slot.end)))
    .sort((a, b) => a.start.localeCompare(b.start));
  const windows: InterviewWindowDraft[] = [];

  ordered.forEach((slot) => {
    const previous = windows[windows.length - 1];
    if (previous && previous.end === slot.start) {
      previous.end = slot.end;
      return;
    }
    windows.push({ id: "", start: slot.start, end: slot.end });
  });

  return windows.map((window, index) => ({
    ...window,
    id: `${window.start}-${window.end}-${index}`,
  }));
}

function normalizeInterviewRules(input: WebsiteHiringInterviewRules | undefined): Required<WebsiteHiringInterviewRules> {
  return {
    ...DEFAULT_INTERVIEW_RULES,
    ...(input ?? {}),
    block_when_job_scheduled: input?.block_when_job_scheduled ?? true,
  };
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
  const [interviewRules, setInterviewRules] = useState<Required<WebsiteHiringInterviewRules>>(DEFAULT_INTERVIEW_RULES);
  const [useSameWeekdayHours, setUseSameWeekdayHours] = useState(true);
  const [showAdvancedSlots, setShowAdvancedSlots] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsModalRoleId, setApplicationsModalRoleId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    day: WebsiteHiringInterviewDayAvailability["day"];
    shouldSelect: boolean;
    lastIndex: number;
  } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    setRoles(websiteConfig.hiring_roles ?? []);
    setInterviewAvailability(normalizeInterviewAvailability(websiteConfig.hiring_interview_availability));
    setInterviewRules(normalizeInterviewRules(websiteConfig.hiring_interview_rules));
    setEditingRoleId(null);
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
    setIsDirty(true);
  };

  const removeRole = (id: string) => {
    setRoles((current) => current.filter((role) => role.id !== id));
    if (editingRoleId === id) {
      setEditingRoleId(null);
    }
    if (applicationsModalRoleId === id) {
      setApplicationsModalRoleId(null);
      setSelectedApplicationId(null);
    }
    setIsDirty(true);
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

  const setInterviewWindowSelected = (
    day: WebsiteHiringInterviewDayAvailability["day"],
    windowStart: string,
    windowEnd: string,
    shouldSelect: boolean,
  ) => {
    updateInterviewDay(day, (current) => {
      const exists = current.slots.some((slot) => slot.start === windowStart && slot.end === windowEnd);
      if (shouldSelect) {
        if (exists) return current;
        const nextSlots = [
          ...current.slots,
          {
            id: crypto.randomUUID(),
            start: windowStart,
            end: windowEnd,
          },
        ];
        return {
          ...current,
          enabled: nextSlots.length > 0,
          slots: nextSlots,
        };
      }

      if (!exists) return current;
      const nextSlots = current.slots.filter((slot) => !(slot.start === windowStart && slot.end === windowEnd));
      return {
        ...current,
        enabled: nextSlots.length > 0,
        slots: nextSlots,
      };
    });
  };

  const setDayAvailabilityEnabled = (
    day: WebsiteHiringInterviewDayAvailability["day"],
    enabled: boolean,
  ) => {
    updateInterviewDay(day, (current) => ({
      ...current,
      enabled,
      slots: enabled && current.slots.length === 0
        ? buildSlotsFromWindow("09:00", "17:00")
        : enabled
          ? current.slots
          : [],
    }));
  };

  const setDayWindow = (
    day: WebsiteHiringInterviewDayAvailability["day"],
    windowId: string,
    field: "start" | "end",
    value: string,
  ) => {
    updateInterviewDay(day, (current) => {
      const windows = getWindowsFromSlots(current.slots);
      const nextWindows = windows.map((window) =>
        window.id === windowId
          ? {
              ...window,
              [field]: value,
              end: field === "start" && timeToMinutes(window.end) <= timeToMinutes(value)
                ? getNextEndTime(value)
                : field === "end"
                  ? value
                  : window.end,
            }
          : window,
      );
      const validWindows = nextWindows.filter((window) => timeToMinutes(window.end) > timeToMinutes(window.start));
      return {
        ...current,
        enabled: validWindows.length > 0,
        slots: buildSlotsFromWindows(validWindows),
      };
    });
  };

  const addDayWindow = (day: WebsiteHiringInterviewDayAvailability["day"]) => {
    updateInterviewDay(day, (current) => {
      const windows = getWindowsFromSlots(current.slots);
      const nextWindow = windows.length > 0 ? { start: "13:00", end: "17:00" } : { start: "09:00", end: "17:00" };
      const nextWindows = [...windows, { id: crypto.randomUUID(), ...nextWindow }];
      return {
        ...current,
        enabled: true,
        slots: buildSlotsFromWindows(nextWindows),
      };
    });
  };

  const removeDayWindow = (
    day: WebsiteHiringInterviewDayAvailability["day"],
    windowId: string,
  ) => {
    updateInterviewDay(day, (current) => {
      const nextWindows = getWindowsFromSlots(current.slots).filter((window) => window.id !== windowId);
      return {
        ...current,
        enabled: nextWindows.length > 0,
        slots: buildSlotsFromWindows(nextWindows),
      };
    });
  };

  const applyWeekdayHours = (start: string, end: string) => {
    const safeEnd = timeToMinutes(end) > timeToMinutes(start) ? end : getNextEndTime(start);
    setInterviewAvailability((current) =>
      current.map((entry) =>
        WEEKDAY_DAYS.includes(entry.day)
          ? { ...entry, enabled: true, slots: buildSlotsFromWindow(start, safeEnd) }
          : entry,
      ),
    );
    setIsDirty(true);
  };

  const applyWeekdayPreset = (start: string, end: string) => {
    setUseSameWeekdayHours(true);
    setInterviewAvailability((current) =>
      current.map((entry) =>
        WEEKDAY_DAYS.includes(entry.day)
          ? { ...entry, enabled: true, slots: buildSlotsFromWindow(start, end) }
          : { ...entry, enabled: false, slots: [] },
      ),
    );
    setIsDirty(true);
  };

  const updateInterviewRules = (updates: Partial<Required<WebsiteHiringInterviewRules>>) => {
    setInterviewRules((current) => ({ ...current, ...updates }));
    setIsDirty(true);
  };

  useEffect(() => {
    if (!dragState) return;
    const handlePointerUp = () => {
      setDragState(null);
    };
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [dragState]);

  const getWindowIndexFromClientX = (container: HTMLDivElement, clientX: number) => {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    const rawIndex = Math.floor(ratio * INTERVIEW_WINDOWS.length);
    return Math.max(0, Math.min(INTERVIEW_WINDOWS.length - 1, rawIndex));
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
        auto_reject: normalizeAutoRejectSettings(role.auto_reject),
      }))
      .filter((role) => role.title.length > 0);
    const cleanedInterviewAvailability = sanitizeInterviewAvailability(interviewAvailability);

    try {
      await updateWebsiteAsync({
        hiring_roles: cleaned,
        hiring_interview_availability: cleanedInterviewAvailability,
        hiring_interview_rules: interviewRules,
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
  const editingRole = editingRoleId ? roles.find((role) => role.id === editingRoleId) ?? null : null;
  const editingAutoReject = editingRole
    ? normalizeAutoRejectSettings(editingRole.auto_reject)
    : DEFAULT_AUTO_REJECT_SETTINGS;
  const mondayAvailability = interviewAvailability.find((entry) => entry.day === "monday");
  const weekdayWindow = getWindowsFromSlots(mondayAvailability?.slots ?? [])[0] ?? {
    id: "weekday-default",
    start: "09:00",
    end: "17:00",
  };

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
                        onClick={() => setEditingRoleId(role.id)}
                        aria-label="Edit role"
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
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview Availability</CardTitle>
            <CardDescription>
              Set interview hours like business hours. Use advanced slots only when you need exact control.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-4">
              {INTERVIEW_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  className="justify-start text-left"
                  onClick={() => applyWeekdayPreset(preset.start, preset.end)}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="justify-start text-left"
                onClick={() => {
                  setUseSameWeekdayHours(false);
                  setIsDirty(true);
                }}
              >
                Custom schedule
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label htmlFor="same-weekday-hours" className="font-medium">Use same hours for weekdays</Label>
                  <p className="text-xs text-muted-foreground">Monday-Friday share one start and end time.</p>
                </div>
                <Switch
                  id="same-weekday-hours"
                  checked={useSameWeekdayHours}
                  onCheckedChange={(checked) => {
                    setUseSameWeekdayHours(checked);
                    if (checked) {
                      applyWeekdayHours(weekdayWindow.start, weekdayWindow.end);
                    } else {
                      setIsDirty(true);
                    }
                  }}
                />
              </div>

              {useSameWeekdayHours ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label>Start time</Label>
                    <Select value={weekdayWindow.start} onValueChange={(value) => applyWeekdayHours(value, weekdayWindow.end)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End time</Label>
                    <Select value={weekdayWindow.end} onValueChange={(value) => applyWeekdayHours(weekdayWindow.start, value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {END_TIME_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={timeToMinutes(option.value) <= timeToMinutes(weekdayWindow.start)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Mon-Fri, {getTimeLabel(weekdayWindow.start)}-{getTimeLabel(weekdayWindow.end)}
                  </div>
                </div>
              ) : null}
            </div>

            {interviewAvailability.map((dayAvailability) => (
              <div key={dayAvailability.day} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={dayAvailability.enabled}
                      onCheckedChange={(checked) => setDayAvailabilityEnabled(dayAvailability.day, checked)}
                      disabled={useSameWeekdayHours && WEEKDAY_DAYS.includes(dayAvailability.day)}
                      aria-label={`Toggle ${INTERVIEW_DAYS.find((day) => day.value === dayAvailability.day)?.label}`}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {INTERVIEW_DAYS.find((day) => day.value === dayAvailability.day)?.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dayAvailability.enabled ? "Available" : "Unavailable"}
                      </p>
                    </div>
                  </div>
                  {dayAvailability.enabled ? (
                    <p className="text-xs text-muted-foreground">
                      {getWindowsFromSlots(dayAvailability.slots).length} window{getWindowsFromSlots(dayAvailability.slots).length === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>

                {dayAvailability.enabled ? (
                  <div className="mt-4 space-y-3">
                    {getWindowsFromSlots(dayAvailability.slots).map((window) => (
                      <div key={window.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div className="space-y-2">
                          <Label>Start time</Label>
                          <Select
                            value={window.start}
                            onValueChange={(value) => setDayWindow(dayAvailability.day, window.id, "start", value)}
                            disabled={useSameWeekdayHours && WEEKDAY_DAYS.includes(dayAvailability.day)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>End time</Label>
                          <Select
                            value={window.end}
                            onValueChange={(value) => setDayWindow(dayAvailability.day, window.id, "end", value)}
                            disabled={useSameWeekdayHours && WEEKDAY_DAYS.includes(dayAvailability.day)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {END_TIME_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  disabled={timeToMinutes(option.value) <= timeToMinutes(window.start)}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground"
                          onClick={() => removeDayWindow(dayAvailability.day, window.id)}
                          disabled={useSameWeekdayHours && WEEKDAY_DAYS.includes(dayAvailability.day)}
                          aria-label="Remove time window"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 px-0 text-primary hover:bg-transparent"
                      onClick={() => addDayWindow(dayAvailability.day)}
                      disabled={useSameWeekdayHours && WEEKDAY_DAYS.includes(dayAvailability.day)}
                    >
                      <Plus className="h-4 w-4" />
                      Add another time window
                    </Button>
                  </div>
                ) : null}

                {showAdvancedSlots ? (
                  <>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Advanced slot editor: one bar equals 12:00 AM to 12:00 AM in 15-minute increments.
                    </p>

                    <div className="mt-3">
                      <div
                        className="grid h-9 select-none overflow-hidden rounded-lg border border-border"
                        style={{ gridTemplateColumns: `repeat(${INTERVIEW_WINDOWS.length}, minmax(0, 1fr))` }}
                        onMouseDown={(event) => {
                          const container = event.currentTarget;
                          const index = getWindowIndexFromClientX(container, event.clientX);
                          const window = INTERVIEW_WINDOWS[index];
                          const selected = dayAvailability.slots.some(
                            (slot) => slot.start === window.start && slot.end === window.end,
                          );
                          const shouldSelect = !selected;
                          setDragState({ day: dayAvailability.day, shouldSelect, lastIndex: index });
                          setInterviewWindowSelected(dayAvailability.day, window.start, window.end, shouldSelect);
                        }}
                        onMouseMove={(event) => {
                          if (!dragState || dragState.day !== dayAvailability.day || (event.buttons & 1) !== 1) return;
                          const container = event.currentTarget;
                          const index = getWindowIndexFromClientX(container, event.clientX);
                          if (index === dragState.lastIndex) return;
                          const window = INTERVIEW_WINDOWS[index];
                          setInterviewWindowSelected(
                            dayAvailability.day,
                            window.start,
                            window.end,
                            dragState.shouldSelect,
                          );
                          setDragState((current) => (current ? { ...current, lastIndex: index } : current));
                        }}
                        onMouseUp={() => {
                          if (dragState?.day === dayAvailability.day) {
                            setDragState(null);
                          }
                        }}
                        onPointerLeave={() => {
                          if (dragState?.day === dayAvailability.day) {
                            setDragState(null);
                          }
                        }}
                      >
                        {INTERVIEW_WINDOWS.map((window, index) => {
                          const selected = dayAvailability.slots.some(
                            (slot) => slot.start === window.start && slot.end === window.end,
                          );
                          return (
                            <div
                              key={`${dayAvailability.day}-${window.start}-${window.end}`}
                              title={window.label}
                              aria-label={`Toggle ${window.label}`}
                              className={`h-full w-full border-r border-border/70 transition-colors last:border-r-0 ${
                                selected ? "bg-primary" : "bg-muted/30"
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
                  </>
                ) : null}
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setShowAdvancedSlots((current) => !current)}
            >
              <Settings2 className="h-4 w-4" />
              {showAdvancedSlots ? "Hide advanced slot editor" : "Advanced slot editor"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Scheduling Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Interview length</Label>
                <Select
                  value={String(interviewRules.interview_length_minutes)}
                  onValueChange={(value) => updateInterviewRules({ interview_length_minutes: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60].map((value) => (
                      <SelectItem key={value} value={String(value)}>{value} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Buffer time</Label>
                <Select
                  value={String(interviewRules.buffer_time_minutes)}
                  onValueChange={(value) => updateInterviewRules({ buffer_time_minutes: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45, 60].map((value) => (
                      <SelectItem key={value} value={String(value)}>{value} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Minimum notice</Label>
                <Select
                  value={String(interviewRules.minimum_notice_hours)}
                  onValueChange={(value) => updateInterviewRules({ minimum_notice_hours: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 12, 24, 48, 72].map((value) => (
                      <SelectItem key={value} value={String(value)}>{value < 24 ? `${value} hr` : `${value / 24} day${value === 24 ? "" : "s"}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Booking window</Label>
                <Select
                  value={String(interviewRules.booking_window_days)}
                  onValueChange={(value) => updateInterviewRules({ booking_window_days: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[7, 14, 21, 30, 60].map((value) => (
                      <SelectItem key={value} value={String(value)}>{value} days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
              <div>
                <Label htmlFor="block-job-conflicts" className="font-medium">
                  Unavailable when a job is scheduled
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hide interview times that conflict with jobs already on the schedule.
                </p>
              </div>
              <Switch
                id="block-job-conflicts"
                checked={interviewRules.block_when_job_scheduled}
                onCheckedChange={(checked) => updateInterviewRules({ block_when_job_scheduled: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editingRole !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingRoleId(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update this job role’s listing details and pre-screening pay range.
            </DialogDescription>
          </DialogHeader>

          {editingRole ? (
            <div className="space-y-4">
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
