import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScheduledJobs } from "@/hooks/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [scheduledTimeStart, setScheduledTimeStart] = useState("");
  const [scheduledTimeEnd, setScheduledTimeEnd] = useState("");
  const [hoveredUnavailableReason, setHoveredUnavailableReason] = useState<string | null>(null);

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

  const addSchedule = () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    const selectedDateString = format(selectedDate, "yyyy-MM-dd");

    if (dayOffDatesSet.has(selectedDateString)) {
      toast.error("This date is marked as a day off.");
      return;
    }

    if (effectiveFullyBookedDatesSet.has(selectedDateString)) {
      toast.error("Daily job limit has been reached for this date.");
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
    setSelectedDate(undefined);
    setScheduledTimeStart("");
    setScheduledTimeEnd("");
    toast.success("Schedule date added");
  };

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, scheduleIndex) => scheduleIndex !== index));
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold flex items-center gap-2">
        <CalendarIcon className="h-4 w-4" />
        Add Schedule Dates
      </Label>

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-center max-w-full overflow-x-auto">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              onMonthChange={setCalendarMonth}
              onDayMouseEnter={(day) => setHoveredUnavailableReason(getDateUnavailableReason(day))}
              onDayMouseLeave={() => setHoveredUnavailableReason(null)}
              disabled={isDateUnavailable}
              className={cn("w-fit rounded-md border pointer-events-auto")}
              modifiers={{
                busy: (date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  return allBusyDatesSet.has(dateStr);
                },
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
                busy: "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
                fullyBooked: "opacity-50 line-through",
                dayOff: "opacity-50 line-through text-destructive",
              }}
            />
          </div>

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

          {selectedDate && selectedDateJobs.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedDateJobs.length} job{selectedDateJobs.length !== 1 ? "s" : ""} on {format(selectedDate, "MMM d")}: 
              </p>
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {selectedDateJobs.map((job: any) => (
                  <div key={job.schedule_id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{job.name || "Unnamed job"}</span>
                    {job.scheduled_time_start && (
                      <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                        {job.scheduled_time_start}{job.scheduled_time_end ? ` - ${job.scheduled_time_end}` : ""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="schedule-start">Start Time</Label>
              <Input
                id="schedule-start"
                type="time"
                value={scheduledTimeStart}
                onChange={(event) => setScheduledTimeStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-end">End Time</Label>
              <Input
                id="schedule-end"
                type="time"
                value={scheduledTimeEnd}
                onChange={(event) => setScheduledTimeEnd(event.target.value)}
              />
            </div>
          </div>

          <Button onClick={addSchedule} disabled={!selectedDate} className="w-full">
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
                    <div key={`${schedule.date}-${index}`} className="flex items-center justify-between p-2 bg-muted rounded">
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
