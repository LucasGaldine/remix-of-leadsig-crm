import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths, parse, isValid } from "date-fns";
import { CalendarDays, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScheduleDateTimePicker } from "@/components/scheduling/ScheduleDateTimePicker";

export type ScheduleEntry = {
  date: string;
  timeStart: string;
  timeEnd: string;
};

type ScheduleAvailability = {
  busyDatesSet: Set<string>;
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
}

export function ScheduleDateBuilder({ schedules, onSchedulesChange, recurringControls }: ScheduleDateBuilderProps) {
  const { currentAccount } = useAuth();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [activeScheduleIndex, setActiveScheduleIndex] = useState<number | null>(null);
  const [isAddingNextDate, setIsAddingNextDate] = useState(false);
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [hoveredUnavailableReason, setHoveredUnavailableReason] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string>("");

  const activeSchedule = activeScheduleIndex !== null ? schedules[activeScheduleIndex] : undefined;
  const selectedDateString = pendingDate || (activeSchedule?.date && !isAddingNextDate ? activeSchedule.date : "");
  const selectedDate = selectedDateString
    ? new Date(`${selectedDateString}T00:00:00`)
    : undefined;
  const scheduledDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(addMonths(calendarMonth, 1));
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const localScheduleCountByDate = useMemo(() => {
    return schedules.reduce<Record<string, number>>((acc, schedule) => {
      acc[schedule.date] = (acc[schedule.date] || 0) + 1;
      return acc;
    }, {});
  }, [schedules]);

  const displayedSchedules = useMemo(
    () =>
      schedules
        .map((schedule, index) => ({ schedule, index }))
        .sort((a, b) => a.schedule.date.localeCompare(b.schedule.date) || a.index - b.index),
    [schedules],
  );

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
          .select("scheduled_date, scheduled_time_start, scheduled_time_end, job:leads!lead_id(name)")
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
      const existingCountsByDate: Record<string, number> = {};
      const scheduledJobsByDate: Record<string, Array<{
        name: string;
        scheduledTimeStart: string | null;
        scheduledTimeEnd: string | null;
      }>> = {};

      schedulesResult.data?.forEach((schedule: any) => {
        if (!schedule.scheduled_date) return;
        busyDatesSet.add(schedule.scheduled_date);
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
    if (!dailyLimit) return new Set(fullyBookedDatesSet);

    const effective = new Set(fullyBookedDatesSet);
    Object.entries(localScheduleCountByDate).forEach(([date, localCount]) => {
      const existingCount = existingCountsByDate[date] || 0;
      if (existingCount + localCount >= dailyLimit) {
        effective.add(date);
      }
    });

    return effective;
  }, [dailyLimit, fullyBookedDatesSet, localScheduleCountByDate, existingCountsByDate]);

  const allBusyDatesSet = useMemo(() => {
    const merged = new Set(busyDatesSet);
    Object.keys(localScheduleCountByDate).forEach((date) => merged.add(date));
    return merged;
  }, [busyDatesSet, localScheduleCountByDate]);
  const selectedDateJobs = selectedDateString ? (scheduledJobsByDate[selectedDateString] ?? []) : [];

  const isDateUnavailable = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return (
      date < today ||
      dayOffDatesSet.has(dateStr) ||
      effectiveFullyBookedDatesSet.has(dateStr)
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

    if (effectiveFullyBookedDatesSet.has(dateStr) && dailyLimit) {
      return `Daily job limit (${dailyLimit}) reached for this date.`;
    }

    return null;
  };

  useEffect(() => {
    if (schedules.length === 0) {
      setActiveScheduleIndex(null);
      if (!isAddingNextDate) {
        setScheduledTimeStart("");
        setScheduledTimeEnd("");
      }
      return;
    }

    if (activeScheduleIndex === null && !isAddingNextDate) {
      setActiveScheduleIndex(schedules.length - 1);
      return;
    }

    if (activeScheduleIndex !== null && activeScheduleIndex >= schedules.length) {
      setActiveScheduleIndex(schedules.length - 1);
    }
  }, [activeScheduleIndex, isAddingNextDate, schedules.length]);

  useEffect(() => {
    if (isAddingNextDate || activeScheduleIndex === null) return;

    const schedule = schedules[activeScheduleIndex];
    if (!schedule) return;

    setScheduledTimeStart(schedule.timeStart || "");
    setScheduledTimeEnd(schedule.timeEnd || "");
    setPendingDate(schedule.date || "");
  }, [activeScheduleIndex, isAddingNextDate, schedules]);

  const canUseDate = (dateStr: string) => {
    const localDate = parse(dateStr, "yyyy-MM-dd", new Date());
    if (!isValid(localDate) || localDate < today) {
      toast.error("Past dates are unavailable.");
      return false;
    }

    if (dayOffDatesSet.has(dateStr)) {
      toast.error("This date is marked as a day off.");
      return false;
    }

    if (effectiveFullyBookedDatesSet.has(dateStr)) {
      toast.error("Daily job limit has been reached for this date.");
      return false;
    }

    return true;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return false;
    const nextDateString = format(date, "yyyy-MM-dd");

    if (!canUseDate(nextDateString)) {
      return false;
    }

    setPendingDate(nextDateString);
    return true;
  };

  const handleDateInputChange = (value: string) => {
    if (!value) return;

    const parsedDate = parse(value, "yyyy-MM-dd", new Date());
    if (!isValid(parsedDate) || format(parsedDate, "yyyy-MM-dd") !== value) {
      toast.error("Please enter a valid date.");
      return;
    }

    setCalendarMonth(parsedDate);
    handleDateSelect(parsedDate);
  };

  const addSchedule = () => {
    const clearScheduleFields = () => {
      setIsAddingNextDate(true);
      setActiveScheduleIndex(null);
      setScheduledTimeStart("");
      setScheduledTimeEnd("");
      setPendingDate("");
      setIsCalendarOpen(false);
    };

    if (pendingDate) {
      onSchedulesChange([
        ...schedules,
        {
          date: pendingDate,
          timeStart: scheduledTimeStart,
          timeEnd: scheduledTimeEnd,
        },
      ]);
      clearScheduleFields();
      return;
    }

    clearScheduleFields();
  };

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, scheduleIndex) => scheduleIndex !== index));
    if (schedules.length <= 1) {
      setActiveScheduleIndex(null);
      setIsAddingNextDate(false);
      setPendingDate("");
      return;
    }

    if (activeScheduleIndex === null) return;
    if (activeScheduleIndex === index) {
      setActiveScheduleIndex(Math.max(0, index - 1));
      return;
    }
    if (activeScheduleIndex > index) {
      setActiveScheduleIndex(activeScheduleIndex - 1);
    }
  };

  const updateActiveScheduleTime = (field: "timeStart" | "timeEnd", value: string) => {
    if (activeScheduleIndex === null || isAddingNextDate) return;
    onSchedulesChange(
      schedules.map((schedule, index) =>
        index === activeScheduleIndex
          ? { ...schedule, [field]: value }
          : schedule,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {recurringControls && (
          <div className="pt-1">
            {recurringControls}
          </div>
        )}

        <div className="max-h-[12.5rem] overflow-y-auto rounded-md border border-border">
          {schedules.length > 0 ? (
            displayedSchedules.map(({ schedule, index }) => {
              const [year, month, day] = schedule.date.split("-").map(Number);
              const localDate = new Date(year, month - 1, day);
              return (
                <div
                  key={`${schedule.date}-${index}`}
                  className="flex items-center justify-between p-3 bg-muted cursor-pointer border-b border-border last:border-b-0"
                  onClick={() => {
                    setIsAddingNextDate(false);
                    setActiveScheduleIndex(index);
                  }}
                >
                  <div className="text-sm">
                    <div className="font-medium">{format(localDate, "EEEE, MMM d, yyyy")}</div>
                    {schedule.timeStart && schedule.timeEnd && (
                      <div className="text-xs text-muted-foreground">
                        {schedule.timeStart} - {schedule.timeEnd}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeSchedule(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="bg-muted p-3 text-sm text-muted-foreground">
              No dates added
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-date-input">Date</Label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="schedule-date-input"
              type="date"
              value={scheduledDate}
              min={format(today, "yyyy-MM-dd")}
              onChange={(event) => handleDateInputChange(event.target.value)}
              className="w-full"
            />
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full gap-2">
                  <CalendarDays className="h-4 w-4" />
                  View Calendar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="w-[20rem]">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return;
                      if (handleDateSelect(date)) {
                        setIsCalendarOpen(false);
                      }
                    }}
                    onMonthChange={setCalendarMonth}
                    disabled={isDateUnavailable}
                    onDayMouseEnter={(day) => setHoveredUnavailableReason(getDateUnavailableReason(day))}
                    onDayMouseLeave={() => setHoveredUnavailableReason(null)}
                    className={cn("w-fit rounded-md border pointer-events-auto")}
                    modifiers={{
                      busy: (date) => allBusyDatesSet.has(format(date, "yyyy-MM-dd")),
                      fullyBooked: (date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        return effectiveFullyBookedDatesSet.has(dateStr);
                      },
                      dayOff: (date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        return dayOffDatesSet.has(dateStr);
                      },
                    }}
                    modifiersClassNames={{
                      busy:
                        "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
                      fullyBooked: "opacity-50 line-through",
                      dayOff: "opacity-50 line-through text-destructive",
                    }}
                    month={calendarMonth}
                  />

                  <div className="border-t border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {selectedDateString
                        ? `Jobs on ${format(new Date(`${selectedDateString}T00:00:00`), "MMM d, yyyy")}`
                        : "Jobs on selected day"}
                    </p>
                    {selectedDateString ? (
                      selectedDateJobs.length > 0 ? (
                        <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                          {selectedDateJobs.map((job, index) => (
                            <div key={`${job.name}-${job.scheduledTimeStart}-${index}`} className="text-sm">
                              <span className="font-medium">{job.name}</span>
                              {job.scheduledTimeStart && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {job.scheduledTimeStart}
                                  {job.scheduledTimeEnd ? ` - ${job.scheduledTimeEnd}` : ""}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No jobs scheduled for this day.</p>
                      )
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Select a day to view scheduled jobs.</p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-3">
          {dayOffDatesSet.size > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              {dayOffDatesSet.size > 0 && (
                <p>Dates marked as day off are unavailable.</p>
              )}
            </div>
          )}

          {hoveredUnavailableReason && (
            <p className="text-xs text-muted-foreground">
              {hoveredUnavailableReason}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <ScheduleDateTimePicker
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            calendarMonth={calendarMonth}
            onCalendarMonthChange={setCalendarMonth}
            showCalendar={false}
            onDayMouseEnter={(day) => setHoveredUnavailableReason(getDateUnavailableReason(day))}
            onDayMouseLeave={() => setHoveredUnavailableReason(null)}
            disabledDate={isDateUnavailable}
            scheduledTimeStart={scheduledTimeStart}
            onScheduledTimeStartChange={(value) => {
              setScheduledTimeStart(value);
              updateActiveScheduleTime("timeStart", value);
            }}
            scheduledTimeEnd={scheduledTimeEnd}
            onScheduledTimeEndChange={(value) => {
              setScheduledTimeEnd(value);
              updateActiveScheduleTime("timeEnd", value);
            }}
            busyDatesSet={allBusyDatesSet}
            modifiers={{
              fullyBooked: (date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                return effectiveFullyBookedDatesSet.has(dateStr);
              },
              dayOff: (date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                return dayOffDatesSet.has(dateStr);
              },
            }}
            modifiersClassNames={{
              fullyBooked: "opacity-50 line-through",
              dayOff: "opacity-50 line-through text-destructive",
            }}
            calendarClassName={cn("rounded-md")}
          />

          <Button
            onClick={addSchedule}
            variant="secondary"
            className="w-full"
            aria-label="Add Schedule Date"
            disabled={!pendingDate}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
