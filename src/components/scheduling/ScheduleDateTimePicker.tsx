import type { ReactNode } from "react";
import { format } from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CalendarModifierMap = Record<string, (date: Date) => boolean>;
type CalendarModifierClassMap = Record<string, string>;

export interface ScheduledDateJob {
  schedule_id: string;
  name?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
}

interface ScheduleDateTimePickerProps {
  selectedDate?: Date;
  onSelectDate: (date: Date | undefined) => void;
  calendarMonth: Date;
  onCalendarMonthChange: (date: Date) => void;
  showCalendar?: boolean;
  disabledDate: (date: Date) => boolean;
  scheduledTimeStart: string;
  onScheduledTimeStartChange: (value: string) => void;
  scheduledTimeEnd: string;
  onScheduledTimeEndChange: (value: string) => void;
  selectedDateJobs?: ScheduledDateJob[];
  busyDatesSet?: Set<string>;
  modifiers?: CalendarModifierMap;
  modifiersClassNames?: CalendarModifierClassMap;
  calendarClassName?: string;
  startTimeInputId?: string;
  endTimeInputId?: string;
  onDayMouseEnter?: (date: Date) => void;
  onDayMouseLeave?: () => void;
  children?: ReactNode;
}

export function ScheduleDateTimePicker({
  selectedDate,
  onSelectDate,
  calendarMonth,
  onCalendarMonthChange,
  showCalendar = true,
  disabledDate,
  scheduledTimeStart,
  onScheduledTimeStartChange,
  scheduledTimeEnd,
  onScheduledTimeEndChange,
  selectedDateJobs = [],
  busyDatesSet,
  modifiers,
  modifiersClassNames,
  calendarClassName,
  startTimeInputId = "schedule-start",
  endTimeInputId = "schedule-end",
  onDayMouseEnter,
  onDayMouseLeave,
  children,
}: ScheduleDateTimePickerProps) {
  const mergedModifiers: CalendarModifierMap = {
    ...(modifiers || {}),
    ...(busyDatesSet
      ? {
          busy: (date: Date) => busyDatesSet.has(format(date, "yyyy-MM-dd")),
        }
      : {}),
  };

  const mergedModifiersClassNames: CalendarModifierClassMap = {
    ...(modifiersClassNames || {}),
    ...(busyDatesSet
      ? {
          busy:
            "relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
        }
      : {}),
  };

  return (
    <div className="space-y-3">
      {showCalendar && (
        <div className="flex justify-center max-w-full overflow-x-auto">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onSelectDate}
            onMonthChange={onCalendarMonthChange}
            disabled={disabledDate}
            onDayMouseEnter={onDayMouseEnter}
            onDayMouseLeave={onDayMouseLeave}
            className={cn("w-fit rounded-md border pointer-events-auto", calendarClassName)}
            modifiers={Object.keys(mergedModifiers).length > 0 ? mergedModifiers : undefined}
            modifiersClassNames={Object.keys(mergedModifiersClassNames).length > 0 ? mergedModifiersClassNames : undefined}
          />
        </div>
      )}

      {selectedDate && selectedDateJobs.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {selectedDateJobs.length} job{selectedDateJobs.length !== 1 ? "s" : ""} on {format(selectedDate, "MMM d")}:
          </p>
          <div className="space-y-1.5 max-h-24 overflow-y-auto">
            {selectedDateJobs.map((job) => (
              <div key={job.schedule_id} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1">{job.name || "Unnamed job"}</span>
                {job.scheduled_time_start && (
                  <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                    {job.scheduled_time_start}
                    {job.scheduled_time_end ? ` - ${job.scheduled_time_end}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={startTimeInputId}>Start Time</Label>
          <Input
            id={startTimeInputId}
            type="time"
            value={scheduledTimeStart}
            onChange={(event) => onScheduledTimeStartChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={endTimeInputId}>End Time</Label>
          <Input
            id={endTimeInputId}
            type="time"
            value={scheduledTimeEnd}
            onChange={(event) => onScheduledTimeEndChange(event.target.value)}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
