import { Calendar, CheckCircle2, Clock, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ScheduleItem {
  scheduled_date: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  is_completed: boolean;
}

interface ClientPortalScheduleProps {
  schedules: ScheduleItem[];
  estimateVisitSchedules?: ScheduleItem[];
}

function ScheduleRow({ schedule, label }: { schedule: ScheduleItem; label?: string }) {
  const isPast = new Date(`${schedule.scheduled_date}T23:59:59`) < new Date();

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        isPast
          ? "bg-slate-50 border-slate-200"
          : "bg-sky-50 border-sky-200"
      )}
    >
      {isPast ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
      ) : (
        <Clock className="h-5 w-5 text-sky-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium text-sm",
            isPast ? "text-slate-500" : "text-slate-900"
          )}
        >
          {format(
            new Date(schedule.scheduled_date + "T00:00:00"),
            "EEEE, MMMM d, yyyy"
          )}
        </p>
        {schedule.scheduled_time_start &&
          schedule.scheduled_time_end && (
            <p className="text-xs text-slate-500 mt-0.5">
              {schedule.scheduled_time_start} -{" "}
              {schedule.scheduled_time_end}
            </p>
          )}
        {label && (
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        )}
      </div>
      {isPast && (
        <span className="text-xs font-medium text-emerald-600">
          Done
        </span>
      )}
    </div>
  );
}

export function ClientPortalSchedule({ schedules, estimateVisitSchedules }: ClientPortalScheduleProps) {
  const hasEstimateVisit = estimateVisitSchedules && estimateVisitSchedules.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">
            Scheduled Dates
          </h2>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-4">
        <div className="space-y-3">
          {hasEstimateVisit && estimateVisitSchedules.map((schedule, index) => (
            <ScheduleRow key={`ev-${index}`} schedule={schedule} label="Estimate Visit" />
          ))}
          {schedules.map((schedule, index) => (
            <ScheduleRow key={index} schedule={schedule} />
          ))}
        </div>
      </div>
    </div>
  );
}
