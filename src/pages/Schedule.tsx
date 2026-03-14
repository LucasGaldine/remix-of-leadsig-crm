import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader as Loader2, Repeat, MapPin, Clock, Calendar as CalendarIcon, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { JobCard } from "@/components/jobs/JobCard";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScheduledJobs, useScheduledJobsForWeek } from "@/hooks/useScheduledJobs";
import { useAuth } from "@/hooks/useAuth";
import { useDaysOff } from "@/hooks/useDaysOff";
import { useProjectedRecurringDates, useCreateRecurringInstance } from "@/hooks/useProjectedRecurringDates";
import { toast } from "sonner";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCrewHours } from "@/hooks/useCrewHours";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewMode = 'week' | 'month';

export default function Schedule() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('schedule-view-mode');
    return (saved === 'week' || saved === 'month') ? saved : 'week';
  });
  const [selectedCrewMember, setSelectedCrewMember] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const { isManager, role, user } = useAuth();
  const { data: teamMembers = [] } = useTeamMembers();

  const [showMyJobsOnly, setShowMyJobsOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem('schedule-view-preference');
    return saved === 'my-jobs';
  });

  useEffect(() => {
    localStorage.setItem('schedule-view-preference', showMyJobsOnly ? 'my-jobs' : 'all-jobs');
  }, [showMyJobsOnly]);

  useEffect(() => {
    localStorage.setItem('schedule-view-mode', viewMode);
  }, [viewMode]);

  const canViewAllJobs = role === 'owner' || role === 'admin' || role === 'sales';
  const canViewCrewHours = role === 'owner' || role === 'admin';

  const effectiveCrewMember = selectedCrewMember || (showMyJobsOnly && user?.id ? user.id : null);
  const myJobsFilter = canViewAllJobs ? (effectiveCrewMember ? true : showMyJobsOnly) : true;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const displayStart = viewMode === 'month' ? monthStart : weekStart;
  const displayEnd = viewMode === 'month' ? monthEnd : weekEnd;

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: todaysJobs = [], isLoading } = useScheduledJobs(selectedDateStr, myJobsFilter, effectiveCrewMember || undefined);
  const { data: jobDates = new Set() } = useScheduledJobsForWeek(displayStart, displayEnd, myJobsFilter, effectiveCrewMember || undefined);
  const { daysOff = [] } = useDaysOff();
  const { data: projectedData } = useProjectedRecurringDates(displayStart, displayEnd);
  const createInstance = useCreateRecurringInstance();
  const { data: crewHours = [] } = useCrewHours(displayStart, displayEnd, effectiveCrewMember || undefined);

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

  const goToPreviousMonth = () => {
    setSelectedDate((prev) => addMonths(prev, -1));
  };

  const goToNextMonth = () => {
    setSelectedDate((prev) => addMonths(prev, 1));
  };

  const monthDays = useMemo(() => {
    if (viewMode !== 'month') return [];

    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start, end });

    const startDayOfWeek = getDay(start);
    const prefixDays = Array.from({ length: startDayOfWeek }, (_, i) =>
      addDays(start, -(startDayOfWeek - i))
    );

    const totalCells = prefixDays.length + days.length;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const suffixDays = Array.from({ length: remainingCells }, (_, i) =>
      addDays(end, i + 1)
    );

    return [...prefixDays, ...days, ...suffixDays];
  }, [selectedDate, viewMode]);

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

      {/* View Controls */}
      <div className="bg-card border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-auto">
            <TabsList>
              <TabsTrigger value="week" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {canViewCrewHours && crewHours.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
              <Clock className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total Hours</span>
                <span className="text-lg font-bold text-primary">
                  {crewHours.reduce((sum, crew) => sum + crew.total_hours, 0).toFixed(1)}h
                </span>
              </div>
            </div>
          )}

          {canViewCrewHours && (
            <Select
              value={selectedCrewMember || "all"}
              onValueChange={(v) => setSelectedCrewMember(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[180px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Crew</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {canViewCrewHours && crewHours.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {selectedCrewMember ? "Crew Member Hours" : "Crew Hours Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {crewHours.slice(0, selectedCrewMember ? 1 : 5).map((crew) => (
                  <div key={crew.user_id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{crew.full_name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{crew.job_count} {crew.job_count === 1 ? 'job' : 'jobs'}</span>
                      <span className="font-semibold text-foreground">
                        {crew.total_hours.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Week/Month View */}
      <div className="bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={viewMode === 'week' ? goToPreviousWeek : goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            {viewMode === 'week'
              ? `${format(weekStart, "MMM d")} - ${format(addDays(weekStart, 6), "MMM d")}`
              : format(selectedDate, "MMMM yyyy")
            }
          </span>
          <button
            onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
            className="p-2 rounded-lg hover:bg-muted active:bg-muted/80 min-h-touch min-w-touch flex items-center justify-center"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {viewMode === 'week' ? (
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
        ) : (
          <div className="px-2 pb-3">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-2xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, index) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const dayStr = format(day, "yyyy-MM-dd");
                const hasJobs = jobDates.has(dayStr);
                const hasProjected = projectedDates.has(dayStr);
                const isDayOff = daysOffMap.has(dayStr);
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth();

                return (
                  <button
                    key={`${day.toISOString()}-${index}`}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-lg transition-colors text-sm",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isCurrentMonth
                        ? "hover:bg-muted active:bg-muted/80"
                        : "text-muted-foreground/40 hover:bg-muted/50",
                      isToday && !isSelected && "ring-2 ring-primary ring-inset"
                    )}
                  >
                    <span className={cn("font-medium", !isCurrentMonth && "opacity-50")}>
                      {format(day, "d")}
                    </span>
                    <div className="flex gap-0.5 mt-0.5">
                      {hasJobs && (
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
                            isSelected ? "bg-primary-foreground/60" : "bg-primary"
                          )}
                        />
                      )}
                      {hasProjected && !hasJobs && (
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
                            isSelected ? "bg-primary-foreground/40" : "bg-emerald-500"
                          )}
                        />
                      )}
                      {isDayOff && (
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
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
        )}
      </div>

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
