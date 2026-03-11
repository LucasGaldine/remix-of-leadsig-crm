import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader as Loader2, Repeat, MapPin, Clock, Building2, User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { JobCard } from "@/components/jobs/JobCard";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScheduledJobs, useScheduledJobsForWeek } from "@/hooks/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { useDaysOff } from "@/hooks/useDaysOff";
import { useProjectedRecurringDates, useCreateRecurringInstance } from "@/hooks/useProjectedRecurringDates";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export default function Schedule() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);
  const { isManager, role } = useAuth();

  const [showMyJobsOnly, setShowMyJobsOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem('schedule-view-preference');
    return saved === 'my-jobs';
  });

  useEffect(() => {
    localStorage.setItem('schedule-view-preference', showMyJobsOnly ? 'my-jobs' : 'all-jobs');
  }, [showMyJobsOnly]);

  const canViewAllJobs = role === 'owner' || role === 'admin' || role === 'sales';
  const myJobsFilter = canViewAllJobs ? showMyJobsOnly : true;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: todaysJobs = [], isLoading } = useScheduledJobs(selectedDateStr, myJobsFilter);
  const { data: jobDates = new Set() } = useScheduledJobsForWeek(weekStart, weekEnd, myJobsFilter);
  const { daysOff = [] } = useDaysOff();
  const { data: projectedData } = useProjectedRecurringDates(weekStart, weekEnd);
  const createInstance = useCreateRecurringInstance();

  const projectedDates = projectedData?.dates ?? new Set<string>();
  const projectedByDate = projectedData?.byDate ?? new Map();
  const selectedProjected = projectedByDate.get(selectedDateStr) || [];

  const daysOffMap = useMemo(() => {
    const map = new Map<string, { reason: string | null }>();
    daysOff.forEach((dayOff) => {
      map.set(dayOff.date, { reason: dayOff.reason });
    });
    return map;
  }, [daysOff]);

  const selectedDayOff = daysOffMap.get(selectedDateStr);

  const goToPreviousWeek = () => {
    setSelectedDate((prev) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setSelectedDate((prev) => addDays(prev, 7));
  };

  const handleCreateInstance = async (projected: any) => {
    try {
      const job = await createInstance.mutateAsync({
        recurringJob: projected.recurringJob,
        date: projected.date,
      });
      toast.success("Job created successfully");
      navigate(`/jobs/${job.id}`);
    } catch (error) {
      console.error("Error creating job instance:", error);
      toast.error("Failed to create job");
    }
  };

  const hasNoContent = todaysJobs.length === 0 && selectedProjected.length === 0;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Schedule"
        subtitle={format(selectedDate, "MMMM yyyy")}
      />


      {/* Week View */}
      <div className="bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d")}
          </span>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex px-2 pb-3">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayStr = format(day, "yyyy-MM-dd");
            const hasJobs = jobDates.has(dayStr);
            const hasProjected = projectedDates.has(dayStr);
            const isDayOff = daysOffMap.has(dayStr);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex-1 flex flex-col items-center py-2 rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted active:bg-muted/80"
                )}
              >
                <span
                  className={cn(
                    "text-2xs font-medium uppercase",
                    isSelected
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  )}
                >
                  {format(day, "EEE")}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold mt-0.5",
                    isSelected
                      ? "text-primary-foreground"
                      : isToday
                      ? "text-primary"
                      : "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                {/* Job, projected, and day off indicators */}
                <div className="flex gap-0.5 mt-1 min-h-[6px]">
                  {hasJobs && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground/60" : "bg-primary"
                      )}
                    />
                  )}
                  {hasProjected && !hasJobs && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground/40" : "bg-emerald-500"
                      )}
                    />
                  )}
                  {isDayOff && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground/60" : "bg-destructive"
                      )}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {canViewAllJobs && (
  <div className="max-w-[var(--content-max-width)] m-auto">
    <div className="inline-flex rounded-lg border border-border bg-muted p-1">

      <button
        onClick={() => setShowMyJobsOnly(false)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
        ${!showMyJobsOnly ? "bg-background shadow-sm" : "text-muted-foreground"}`}
      >
        <Building2 className="h-4 w-4" />
        All Jobs
      </button>

      <button
        onClick={() => setShowMyJobsOnly(true)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
        ${showMyJobsOnly ? "bg-background shadow-sm" : "text-muted-foreground"}`}
      >
        <User className="h-4 w-4" />
        My Jobs
      </button>

    </div>
  </div>
)}

      {/* Jobs List */}
      <main className="px-4 py-4 max-w-[var(--content-max-width)] m-auto mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {format(selectedDate, "EEEE, MMMM d")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {todaysJobs.length} {todaysJobs.length === 1 ? "job" : "jobs"}
            {selectedProjected.length > 0 && (
              <span className="text-emerald-600">
                {" "}+ {selectedProjected.length} recurring
              </span>
            )}
          </span>
        </div>

        {selectedDayOff && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive">Day Off</p>
            {selectedDayOff.reason && (
              <p className="text-sm text-muted-foreground mt-1">{selectedDayOff.reason}</p>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {todaysJobs.length > 0 && (
              <div className="space-y-3">
                {todaysJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  />
                ))}
              </div>
            )}

            {selectedProjected.length > 0 && (
              <div className={cn("space-y-3", todaysJobs.length > 0 && "mt-4")}>
                {todaysJobs.length > 0 && selectedProjected.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <Repeat className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-emerald-700">Upcoming Recurring</span>
                  </div>
                )}
                {selectedProjected.map((projected: any) => (
                  <div
                    key={`${projected.recurringJob.id}-${projected.date}`}
                    className="w-full text-left bg-card border-2 border-dashed border-emerald-300 rounded-lg p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Repeat className="h-3 w-3" />
                            Recurring
                          </span>
                        </div>
                        <h3 className="font-semibold text-foreground text-lg">
                          {projected.recurringJob.name}
                        </h3>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                          {projected.recurringJob.service_type || "No service type"}
                        </p>
                        <div className="flex flex-col gap-1 mt-3">
                          {projected.recurringJob.address && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{projected.recurringJob.address}</span>
                            </div>
                          )}
                          {(projected.recurringJob.scheduled_time_start || projected.recurringJob.scheduled_time_end) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>
                                {projected.recurringJob.scheduled_time_start || ""}
                                {projected.recurringJob.scheduled_time_start && projected.recurringJob.scheduled_time_end && " - "}
                                {projected.recurringJob.scheduled_time_end || ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {projected.recurringJob.estimated_value > 0 && (
                          <span className="text-lg font-bold text-foreground">
                            ${projected.recurringJob.estimated_value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      className="w-full mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleCreateInstance(projected)}
                      disabled={createInstance.isPending}
                    >
                      {createInstance.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Create Job
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {hasNoContent && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No jobs scheduled for this day</p>
                {isManager() && (
                  <Button
                    className="mt-4 gap-2"
                    onClick={() => navigate("/jobs")}
                  >
                    <Plus className="h-4 w-4" />
                    Schedule a Job
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
