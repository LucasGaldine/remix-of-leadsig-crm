import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths, parse, isValid } from "date-fns";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { MonthDayDateBadge } from "@/components/shared/MonthDayDateBadge";

export type ScheduleEntry = {
  date: string;
  timeStart: string;
  timeEnd: string;
};

type ScheduleAvailability = {
  busyDatesSet: Set<string>;
  otherJobsBusyDatesSet: Set<string>;
  dayOffDatesSet: Set<string>;
  dayOffReasonsByDate: Record<string, string | null>;
  fullyBookedDatesSet: Set<string>;
  existingCountsByDate: Record<string, number>;
  scheduledJobsByDate: Record<string, Array<{
    name: string;
    scheduledTimeStart: string | null;
    scheduledTimeEnd: string | null;
  }>>;
  dailyLimit: number | null;
};

interface ScheduleDateBuilderProps {
  schedules: ScheduleEntry[];
  onSchedulesChange: (schedules: ScheduleEntry[]) => void;
  recurringControls?: ReactNode;
  currentLeadId?: string;
  ignoreExistingScheduleConstraints?: boolean;
}

export function ScheduleDateBuilder({
  schedules,
  onSchedulesChange,
  recurringControls,
  currentLeadId,
  ignoreExistingScheduleConstraints = false,
}: ScheduleDateBuilderProps) {
  const { currentAccount } = useAuth();
  const calendarWrapperRef = useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [hoveredUnavailableReason, setHoveredUnavailableReason] = useState<string | null>(null);
  const [mutedDeselectedDates, setMutedDeselectedDates] = useState<Set<string>>(new Set());
  const [defaultTimeStart, setDefaultTimeStart] = useState(() => schedules[0]?.timeStart ?? "");
  const [defaultTimeEnd, setDefaultTimeEnd] = useState(() => schedules[0]?.timeEnd ?? "");
  const [didInitializeFromSchedules, setDidInitializeFromSchedules] = useState(() => schedules.length > 0);
  const [isCustomTimesOpen, setIsCustomTimesOpen] = useState(false);
  const initiallyScheduledDateSetRef = useRef(new Set(schedules.map((schedule) => schedule.date)));
  const isPrimaryPointerDownRef = useRef(false);
  const dragModeRef = useRef<"add" | "remove" | null>(null);
  const dragVisitedDatesRef = useRef<Set<string>>(new Set());
  const dragMutatedSelectionRef = useRef(false);
  const applyDragSelectionRef = useRef<(date: Date) => void>(() => undefined);
  const lastHoveredDayRef = useRef<Date | null>(null);
  const scheduleDateSetRef = useRef(new Set<string>());
  const schedulesRef = useRef<ScheduleEntry[]>(schedules);
  const [customDateSet, setCustomDateSet] = useState<Set<string>>(() => {
    if (schedules.length === 0) return new Set<string>();
    const baseStart = schedules[0]?.timeStart ?? "";
    const baseEnd = schedules[0]?.timeEnd ?? "";
    return new Set(
      schedules
        .filter((schedule) => schedule.timeStart !== baseStart || schedule.timeEnd !== baseEnd)
        .map((schedule) => schedule.date),
    );
  });

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(addMonths(calendarMonth, 1));
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const localScheduleCountByDate = useMemo(() => {
    return schedules.reduce<Record<string, number>>((acc, schedule) => {
      acc[schedule.date] = (acc[schedule.date] || 0) + 1;
      return acc;
    }, {});
  }, [schedules]);

  const scheduleDateSet = useMemo(() => new Set(schedules.map((schedule) => schedule.date)), [schedules]);

  const displayedSchedules = useMemo(
    () =>
      schedules
        .map((schedule, index) => ({ schedule, index }))
        .sort((a, b) => a.schedule.date.localeCompare(b.schedule.date) || a.index - b.index),
    [schedules],
  );

  const selectedDates = useMemo(
    () => schedules.map((schedule) => parse(schedule.date, "yyyy-MM-dd", new Date())).filter((date) => isValid(date)),
    [schedules],
  );

  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    scheduleDateSetRef.current = new Set(scheduleDateSet);
  }, [scheduleDateSet]);

  const resetDragSelectionState = useCallback(() => {
    dragModeRef.current = null;
    dragVisitedDatesRef.current.clear();
    dragMutatedSelectionRef.current = false;
  }, []);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        isPrimaryPointerDownRef.current = true;

        const target = event.target as HTMLElement | null;
        const dayButton = target?.closest?.("button[role='gridcell']");
        const wrapper = calendarWrapperRef.current;
        if (!dayButton || !wrapper || !wrapper.contains(dayButton)) return;
        if (!lastHoveredDayRef.current) return;

        applyDragSelectionRef.current(lastHoveredDayRef.current);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.isPrimary && event.button === 0) {
        isPrimaryPointerDownRef.current = true;
      }
    };

    const handleMouseUp = () => {
      isPrimaryPointerDownRef.current = false;
      resetDragSelectionState();
    };

    const handlePointerUp = () => {
      isPrimaryPointerDownRef.current = false;
      resetDragSelectionState();
    };

    const handleWindowBlur = () => {
      isPrimaryPointerDownRef.current = false;
      resetDragSelectionState();
    };

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [resetDragSelectionState]);

  useEffect(() => {
    setCustomDateSet((current) => {
      const validDates = new Set(schedules.map((schedule) => schedule.date));
      return new Set(Array.from(current).filter((date) => validDates.has(date)));
    });
  }, [schedules]);

  useEffect(() => {
    if (didInitializeFromSchedules || schedules.length === 0) return;
    const baseStart = schedules[0]?.timeStart ?? "";
    const baseEnd = schedules[0]?.timeEnd ?? "";
    setDefaultTimeStart(baseStart);
    setDefaultTimeEnd(baseEnd);
    setCustomDateSet(
      new Set(
        schedules
          .filter((schedule) => schedule.timeStart !== baseStart || schedule.timeEnd !== baseEnd)
          .map((schedule) => schedule.date),
      ),
    );
    setDidInitializeFromSchedules(true);
  }, [didInitializeFromSchedules, schedules]);

  useEffect(() => {
    if (customDateSet.size > 0) {
      setIsCustomTimesOpen(true);
    }
  }, [customDateSet]);

  const { data: availabilityData } = useQuery<ScheduleAvailability | Set<string>>({
    queryKey: [
      "schedule-availability",
      currentAccount?.id,
      format(monthStart, "yyyy-MM-dd"),
      format(monthEnd, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      if (!currentAccount?.id) {
        return {
          busyDatesSet: new Set<string>(),
          otherJobsBusyDatesSet: new Set<string>(),
          dayOffDatesSet: new Set<string>(),
          dayOffReasonsByDate: {},
          fullyBookedDatesSet: new Set<string>(),
          existingCountsByDate: {},
          scheduledJobsByDate: {},
          dailyLimit: null,
        };
      }

      const [schedulesResult, daysOffResult, accountResult] = await Promise.all([
        supabase
          .from("job_schedules")
          .select("lead_id, scheduled_date, scheduled_time_start, scheduled_time_end, job:leads!lead_id(name)")
          .eq("account_id", currentAccount.id)
          .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
          .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"))
          .order("scheduled_date", { ascending: true })
          .order("scheduled_time_start", { ascending: true, nullsFirst: false }),
        supabase
          .from("days_off")
          .select("date, reason")
          .eq("account_id", currentAccount.id)
          .gte("date", format(monthStart, "yyyy-MM-dd"))
          .lte("date", format(monthEnd, "yyyy-MM-dd")),
        supabase
          .from("accounts")
          .select("settings")
          .eq("id", currentAccount.id)
          .maybeSingle(),
      ]);

      if (schedulesResult.error) throw schedulesResult.error;
      if (daysOffResult.error) throw daysOffResult.error;
      if (accountResult.error) throw accountResult.error;

      const busyDatesSet = new Set<string>();
      const otherJobsBusyDatesSet = new Set<string>();
      const existingCountsByDate: Record<string, number> = {};
      const scheduledJobsByDate: Record<string, Array<{
        name: string;
        scheduledTimeStart: string | null;
        scheduledTimeEnd: string | null;
      }>> = {};

      schedulesResult.data?.forEach((schedule: any) => {
        if (!schedule.scheduled_date) return;
        busyDatesSet.add(schedule.scheduled_date);
        if (!currentLeadId || schedule.lead_id !== currentLeadId) {
          otherJobsBusyDatesSet.add(schedule.scheduled_date);
        }
        existingCountsByDate[schedule.scheduled_date] = (existingCountsByDate[schedule.scheduled_date] || 0) + 1;
        if (!scheduledJobsByDate[schedule.scheduled_date]) {
          scheduledJobsByDate[schedule.scheduled_date] = [];
        }
        scheduledJobsByDate[schedule.scheduled_date].push({
          name: schedule.job?.name || "Unnamed job",
          scheduledTimeStart: schedule.scheduled_time_start ?? null,
          scheduledTimeEnd: schedule.scheduled_time_end ?? null,
        });
      });

      const dayOffDatesSet = new Set<string>();
      const dayOffReasonsByDate: Record<string, string | null> = {};
      daysOffResult.data?.forEach((entry) => {
        if (!entry.date) return;
        dayOffDatesSet.add(entry.date);
        dayOffReasonsByDate[entry.date] = entry.reason || null;
      });

      const dailyLimitRaw = Number(accountResult.data?.settings?.daily_job_limit);
      const dailyLimit = Number.isFinite(dailyLimitRaw) && dailyLimitRaw > 0
        ? dailyLimitRaw
        : null;

      const fullyBookedDatesSet = new Set<string>();
      if (dailyLimit) {
        Object.entries(existingCountsByDate).forEach(([date, count]) => {
          if (count >= dailyLimit) fullyBookedDatesSet.add(date);
        });
      }

      return {
        busyDatesSet,
        otherJobsBusyDatesSet,
        dayOffDatesSet,
        dayOffReasonsByDate,
        fullyBookedDatesSet,
        existingCountsByDate,
        scheduledJobsByDate,
        dailyLimit,
      };
    },
    enabled: Boolean(currentAccount?.id),
  });

  const busyDatesSet = availabilityData instanceof Set
    ? availabilityData
    : (availabilityData?.busyDatesSet ?? new Set<string>());
  const otherJobsBusyDatesSet = availabilityData instanceof Set
    ? availabilityData
    : (availabilityData?.otherJobsBusyDatesSet ?? busyDatesSet);
  const dayOffDatesSet = availabilityData instanceof Set
    ? new Set<string>()
    : (availabilityData?.dayOffDatesSet ?? new Set<string>());
  const dayOffReasonsByDate = availabilityData instanceof Set
    ? {}
    : (availabilityData?.dayOffReasonsByDate ?? {});
  const existingCountsByDate = availabilityData instanceof Set
    ? {}
    : (availabilityData?.existingCountsByDate ?? {});
  const scheduledJobsByDate = availabilityData instanceof Set
    ? {}
    : (availabilityData?.scheduledJobsByDate ?? {});
  const dailyLimit = availabilityData instanceof Set
    ? null
    : (availabilityData?.dailyLimit ?? null);
  const fullyBookedDatesSet = availabilityData instanceof Set
    ? new Set<string>()
    : (availabilityData?.fullyBookedDatesSet ?? new Set<string>());

  const effectiveFullyBookedDatesSet = useMemo(() => {
    if (ignoreExistingScheduleConstraints) {
      return new Set<string>();
    }

    if (!dailyLimit) return new Set(fullyBookedDatesSet);

    const effective = new Set(fullyBookedDatesSet);
    Object.entries(localScheduleCountByDate).forEach(([date, localCount]) => {
      const existingCount = existingCountsByDate[date] || 0;
      if (existingCount + localCount >= dailyLimit) {
        effective.add(date);
      }
    });

    return effective;
  }, [dailyLimit, fullyBookedDatesSet, ignoreExistingScheduleConstraints, localScheduleCountByDate, existingCountsByDate]);

  const indicatorBusyDatesSet = useMemo(() => {
    if (ignoreExistingScheduleConstraints) {
      return new Set(Object.keys(localScheduleCountByDate));
    }

    const merged = new Set(otherJobsBusyDatesSet);
    Object.keys(localScheduleCountByDate).forEach((date) => merged.add(date));
    return merged;
  }, [ignoreExistingScheduleConstraints, otherJobsBusyDatesSet, localScheduleCountByDate]);

  const isDateUnavailable = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const isAlreadySelected = scheduleDateSet.has(dateStr);
    return (
      date < today ||
      dayOffDatesSet.has(dateStr) ||
      (!ignoreExistingScheduleConstraints && effectiveFullyBookedDatesSet.has(dateStr) && !isAlreadySelected)
    );
  };

  const getDateUnavailableReason = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    if (date < today) {
      return "Past dates are unavailable.";
    }

    if (dayOffDatesSet.has(dateStr)) {
      const dayOffReason = dayOffReasonsByDate[dateStr];
      return dayOffReason
        ? `Day off: ${dayOffReason}`
        : "This date is marked as a day off.";
    }

    if (
      !ignoreExistingScheduleConstraints &&
      effectiveFullyBookedDatesSet.has(dateStr) &&
      dailyLimit &&
      !scheduleDateSet.has(dateStr)
    ) {
      return `Daily job limit (${dailyLimit}) reached for this date.`;
    }

    return null;
  };

  const canUseDate = useCallback((dateStr: string, options?: { notify?: boolean }) => {
    const notify = options?.notify ?? true;
    const localDate = parse(dateStr, "yyyy-MM-dd", new Date());
    if (!isValid(localDate) || localDate < today) {
      if (notify) toast.error("Past dates are unavailable.");
      return false;
    }

    if (dayOffDatesSet.has(dateStr)) {
      if (notify) toast.error("This date is marked as a day off.");
      return false;
    }

    if (
      !ignoreExistingScheduleConstraints &&
      effectiveFullyBookedDatesSet.has(dateStr) &&
      !scheduleDateSet.has(dateStr)
    ) {
      if (notify) toast.error("Daily job limit has been reached for this date.");
      return false;
    }

    return true;
  }, [dayOffDatesSet, effectiveFullyBookedDatesSet, ignoreExistingScheduleConstraints, scheduleDateSet, today]);

  const applyDateSelection = useCallback((nextDateSet: Set<string>) => {
    const normalizedDateStrings = Array.from(nextDateSet)
      .filter((dateStr) => canUseDate(dateStr, { notify: false }))
      .sort((a, b) => a.localeCompare(b));
    const normalizedDateSet = new Set(normalizedDateStrings);
    const previousDateSet = scheduleDateSetRef.current;
    const removedDates = Array.from(previousDateSet).filter((date) => !normalizedDateSet.has(date));
    const addedDates = normalizedDateStrings.filter((date) => !previousDateSet.has(date));

    setMutedDeselectedDates((current) => {
      const next = new Set(current);
      removedDates.forEach((date) => {
        if (initiallyScheduledDateSetRef.current.has(date)) {
          next.add(date);
        }
      });
      addedDates.forEach((date) => next.delete(date));
      return next;
    });

    const currentSchedules = schedulesRef.current;
    const nextSchedules = normalizedDateStrings
      .map((dateStr) => currentSchedules.find((schedule) => schedule.date === dateStr) || {
        date: dateStr,
        timeStart: defaultTimeStart,
        timeEnd: defaultTimeEnd,
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    scheduleDateSetRef.current = normalizedDateSet;
    onSchedulesChange(nextSchedules);
  }, [canUseDate, defaultTimeEnd, defaultTimeStart, onSchedulesChange]);

  const toggleDate = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const nextDateSet = new Set(scheduleDateSetRef.current);
    if (nextDateSet.has(dateStr)) {
      nextDateSet.delete(dateStr);
    } else {
      nextDateSet.add(dateStr);
    }
    applyDateSelection(nextDateSet);
  }, [applyDateSelection]);

  const applyDragSelection = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (!canUseDate(dateStr, { notify: false })) return;
    if (dragVisitedDatesRef.current.has(dateStr)) return;

    if (!dragModeRef.current) {
      dragModeRef.current = scheduleDateSetRef.current.has(dateStr) ? "remove" : "add";
    }

    dragVisitedDatesRef.current.add(dateStr);

    const nextDateSet = new Set(scheduleDateSetRef.current);
    if (dragModeRef.current === "add") {
      if (nextDateSet.has(dateStr)) return;
      nextDateSet.add(dateStr);
    } else {
      if (!nextDateSet.has(dateStr)) return;
      nextDateSet.delete(dateStr);
    }

    dragMutatedSelectionRef.current = true;
    applyDateSelection(nextDateSet);
  }, [applyDateSelection, canUseDate]);

  useEffect(() => {
    applyDragSelectionRef.current = applyDragSelection;
  }, [applyDragSelection]);

  const handleDayClick: React.ComponentProps<typeof Calendar>["onDayClick"] = (day) => {
    if (dragMutatedSelectionRef.current) {
      const dayStr = format(day, "yyyy-MM-dd");
      const wasVisitedDuringDrag = dragVisitedDatesRef.current.has(dayStr);
      resetDragSelectionState();
      if (wasVisitedDuringDrag) return;
      toggleDate(day);
      return;
    }

    toggleDate(day);
  };

  const handleDayMouseEnter: React.ComponentProps<typeof Calendar>["onDayMouseEnter"] = (day, _activeModifiers, event) => {
    lastHoveredDayRef.current = day;
    setHoveredUnavailableReason(getDateUnavailableReason(day));

    if (isPrimaryPointerDownRef.current && event.buttons !== 1) {
      isPrimaryPointerDownRef.current = false;
      resetDragSelectionState();
      return;
    }

    if (isPrimaryPointerDownRef.current || event.buttons === 1) {
      applyDragSelection(day);
      return;
    }

    if (dragModeRef.current) {
      resetDragSelectionState();
    }
  };

  const handleDayMouseLeave: React.ComponentProps<typeof Calendar>["onDayMouseLeave"] = () => {
    lastHoveredDayRef.current = null;
    setHoveredUnavailableReason(null);

    if (dragModeRef.current && !isPrimaryPointerDownRef.current) {
      resetDragSelectionState();
    }
  };

  const handleDayPointerEnter: React.ComponentProps<typeof Calendar>["onDayPointerEnter"] = (day, _activeModifiers, event) => {
    lastHoveredDayRef.current = day;
    setHoveredUnavailableReason(getDateUnavailableReason(day));

    if (isPrimaryPointerDownRef.current && event.buttons !== 1) {
      isPrimaryPointerDownRef.current = false;
      resetDragSelectionState();
      return;
    }

    if (isPrimaryPointerDownRef.current || event.buttons === 1) {
      applyDragSelection(day);
      return;
    }

    if (dragModeRef.current) {
      resetDragSelectionState();
    }
  };

  const updateScheduleTime = (index: number, field: "timeStart" | "timeEnd", value: string) => {
    onSchedulesChange(
      schedules.map((schedule, scheduleIndex) =>
        scheduleIndex === index
          ? { ...schedule, [field]: value }
          : schedule,
      ),
    );
  };

  const updateDefaultTime = (field: "timeStart" | "timeEnd", value: string) => {
    if (field === "timeStart") {
      setDefaultTimeStart(value);
    } else {
      setDefaultTimeEnd(value);
    }

    onSchedulesChange(
      schedules.map((schedule) => {
        if (customDateSet.has(schedule.date)) return schedule;
        return {
          ...schedule,
          [field]: value,
        };
      }),
    );
  };

  const toggleDateCustomTime = (date: string) => {
    const isCustom = customDateSet.has(date);
    const nextCustomSet = new Set(customDateSet);

    if (isCustom) {
      nextCustomSet.delete(date);
      onSchedulesChange(
        schedules.map((schedule) =>
          schedule.date === date
            ? {
              ...schedule,
              timeStart: defaultTimeStart,
              timeEnd: defaultTimeEnd,
            }
            : schedule,
        ),
      );
    } else {
      nextCustomSet.add(date);
    }

    setCustomDateSet(nextCustomSet);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {recurringControls && (
          <div className="pt-1">
            {recurringControls}
          </div>
        )}

        <div ref={calendarWrapperRef} className="p-2">
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onDayClick={handleDayClick}
            onMonthChange={setCalendarMonth}
            month={calendarMonth}
            disabled={isDateUnavailable}
            onDayMouseEnter={handleDayMouseEnter}
            onDayMouseLeave={handleDayMouseLeave}
            onDayPointerEnter={handleDayPointerEnter}
            className={cn("mx-auto w-fit rounded-md pointer-events-auto")}
            modifiers={{
              busy: (date) =>
                date >= today && indicatorBusyDatesSet.has(format(date, "yyyy-MM-dd")),
              mutedDeselected: (date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                return mutedDeselectedDates.has(dateStr) && !scheduleDateSet.has(dateStr);
              },
              fullyBooked: (date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                return effectiveFullyBookedDatesSet.has(dateStr) && !scheduleDateSet.has(dateStr);
              },
              dayOff: (date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                return dayOffDatesSet.has(dateStr);
              },
            }}
            modifiersClassNames={{
              busy:
                "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
              mutedDeselected:
                "rounded-full bg-foreground/15 text-foreground",
              fullyBooked: "opacity-50 line-through",
              dayOff: "opacity-50 line-through text-destructive",
            }}
          />
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3 pb-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-default-start">Start Time</Label>
              <Input
                id="schedule-default-start"
                type="time"
                value={defaultTimeStart}
                onChange={(event) => updateDefaultTime("timeStart", event.target.value)}
                className="h-10 px-3 py-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-default-end">End Time</Label>
              <Input
                id="schedule-default-end"
                type="time"
                value={defaultTimeEnd}
                onChange={(event) => updateDefaultTime("timeEnd", event.target.value)}
                className="h-10 px-3 py-2"
              />
            </div>
          </div>

          {schedules.length > 0 ? (
            <Collapsible open={isCustomTimesOpen} onOpenChange={setIsCustomTimesOpen} className="space-y-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-1 py-2 text-sm font-semibold text-muted-foreground/70 hover:text-muted-foreground/80 transition-colors"
                >
                  <span>Custom times</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isCustomTimesOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={cn(schedules.length > 3 && "max-h-[10.5rem] overflow-y-auto pr-1")}>
                  {displayedSchedules.map(({ schedule, index }) => {
                    const parsedDate = parse(schedule.date, "yyyy-MM-dd", new Date());
                    const isCustomTime = customDateSet.has(schedule.date);
                    return (
                      <div key={`${schedule.date}-${index}`} className="py-3">
                        <div className="grid grid-cols-[auto_1fr] items-start gap-3">
                          <div>
                            {isValid(parsedDate) ? (
                              <MonthDayDateBadge date={parsedDate} size="sm" />
                            ) : (
                              <div className="text-sm text-muted-foreground">{schedule.date}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => toggleDateCustomTime(schedule.date)}
                              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {isCustomTime ? "Use default time" : "Set custom time"}
                            </button>
                            {isCustomTime && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`schedule-start-${index}`} className="sr-only">Custom Start Time</Label>
                                  <Input
                                    id={`schedule-start-${index}`}
                                    type="time"
                                    value={schedule.timeStart}
                                    onChange={(event) => updateScheduleTime(index, "timeStart", event.target.value)}
                                    className="h-10 px-3 py-2"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`schedule-end-${index}`} className="sr-only">Custom End Time</Label>
                                  <Input
                                    id={`schedule-end-${index}`}
                                    type="time"
                                    value={schedule.timeEnd}
                                    onChange={(event) => updateScheduleTime(index, "timeEnd", event.target.value)}
                                    className="h-10 px-3 py-2"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="bg-muted rounded-md p-3 text-sm text-muted-foreground">
              No dates added
            </div>
          )}
        </div>

        <div className="space-y-3">
          {dayOffDatesSet.size > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Dates marked as day off are unavailable.</p>
            </div>
          )}

          {hoveredUnavailableReason && (
            <p className="text-xs text-muted-foreground">
              {hoveredUnavailableReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
