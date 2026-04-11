import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScheduleDateTimePicker, type ScheduledDateJob } from "@/components/scheduling/ScheduleDateTimePicker";

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
  dailyLimit: number | null;
};

interface ScheduleDateBuilderProps {
  schedules: ScheduleEntry[];
  onSchedulesChange: (schedules: ScheduleEntry[]) => void;
}

export function ScheduleDateBuilder({ schedules, onSchedulesChange }: ScheduleDateBuilderProps) {
  const { currentAccount } = useAuth();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [activeScheduleIndex, setActiveScheduleIndex] = useState<number | null>(null);
  const [isAddingNextDate, setIsAddingNextDate] = useState(false);
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [hoveredUnavailableReason, setHoveredUnavailableReason] = useState<string | null>(null);

  const activeSchedule = activeScheduleIndex !== null ? schedules[activeScheduleIndex] : undefined;
  const selectedDate = activeSchedule?.date && !isAddingNextDate
    ? new Date(`${activeSchedule.date}T00:00:00`)
    : undefined;
  const scheduledDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const { data: selectedDateJobs = [] } = useScheduledJobs(scheduledDate);

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(addMonths(calendarMonth, 1));
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const localScheduleCountByDate = useMemo(() => {
    return schedules.reduce<Record<string, number>>((acc, schedule) => {
      acc[schedule.date] = (acc[schedule.date] || 0) + 1;
      return acc;
    }, {});
  }, [schedules]);

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
          dailyLimit: null,
        };
      }

      const [schedulesResult, daysOffResult, accountResult] = await Promise.all([
        supabase
          .from("job_schedules")
          .select("scheduled_date")
          .eq("account_id", currentAccount.id)
          .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
          .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd")),
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

      schedulesResult.data?.forEach((schedule) => {
        if (!schedule.scheduled_date) return;
        busyDatesSet.add(schedule.scheduled_date);
        existingCountsByDate[schedule.scheduled_date] = (existingCountsByDate[schedule.scheduled_date] || 0) + 1;
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
  }, [activeScheduleIndex, isAddingNextDate, schedules]);

  const canUseDate = (dateStr: string) => {
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
    if (!date) return;
    const selectedDateString = format(date, "yyyy-MM-dd");

    if (!canUseDate(selectedDateString)) {
      return;
    }

    if (activeScheduleIndex !== null && !isAddingNextDate) {
      onSchedulesChange(
        schedules.map((schedule, index) =>
          index === activeScheduleIndex
            ? { ...schedule, date: selectedDateString }
            : schedule,
        ),
      );
      return;
    }

    onSchedulesChange([
      ...schedules,
      {
        date: selectedDateString,
        timeStart: scheduledTimeStart,
        timeEnd: scheduledTimeEnd,
      },
    ]);
    setActiveScheduleIndex(schedules.length);
    setIsAddingNextDate(false);
  };

  const addSchedule = () => {
    setIsAddingNextDate(true);
    setActiveScheduleIndex(null);
    setScheduledTimeStart("");
    setScheduledTimeEnd("");
  };

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, scheduleIndex) => scheduleIndex !== index));
    if (schedules.length <= 1) {
      setActiveScheduleIndex(null);
      setIsAddingNextDate(false);
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
      <Label className="text-base font-semibold flex items-center gap-2">
        <CalendarIcon className="h-4 w-4" />
        Add Schedule Dates
      </Label>

      <div className="space-y-4">
        <div className="space-y-3">
          {(dailyLimit || dayOffDatesSet.size > 0) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {dailyLimit && (
                <p>Dates at the daily limit ({dailyLimit}) are unavailable.</p>
              )}
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
            selectedDateJobs={selectedDateJobs as ScheduledDateJob[]}
            showNoDateSelectedState={false}
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

          <Button onClick={addSchedule} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule Date
          </Button>

          {schedules.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">Added Schedules ({schedules.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {schedules.map((schedule, index) => {
                  const [year, month, day] = schedule.date.split("-").map(Number);
                  const localDate = new Date(year, month - 1, day);
                  return (
                    <div
                      key={`${schedule.date}-${index}`}
                      className={cn(
                        "flex items-center justify-between p-2 bg-muted rounded cursor-pointer border border-transparent",
                        activeScheduleIndex === index && !isAddingNextDate && "border-primary/40",
                      )}
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
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
