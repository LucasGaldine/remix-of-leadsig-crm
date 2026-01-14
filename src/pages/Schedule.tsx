import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { JobCard, Job } from "@/components/jobs/JobCard";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Demo data
const scheduledJobs: Job[] = [
  {
    id: "1",
    clientName: "Johnson Residence",
    clientAddress: "1234 Oak Street, Springfield",
    serviceType: "Patio Installation",
    scheduledTime: "8:00 AM - 12:00 PM",
    status: "in-progress",
    crewLead: "Mike Thompson",
    estimateValue: 8500,
  },
  {
    id: "2",
    clientName: "Anderson Property",
    clientAddress: "567 Maple Ave, Riverside",
    serviceType: "Retaining Wall",
    scheduledTime: "1:00 PM - 5:00 PM",
    status: "scheduled",
    crewLead: "Carlos Rodriguez",
    estimateValue: 12000,
  },
  {
    id: "3",
    clientName: "Miller Estate",
    clientAddress: "890 Pine Road, Lakewood",
    serviceType: "Walkway Installation",
    scheduledTime: "9:00 AM - 2:00 PM",
    status: "scheduled",
    crewLead: "Mike Thompson",
    estimateValue: 5200,
  },
];

export default function Schedule() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToPreviousWeek = () => {
    setSelectedDate((prev) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setSelectedDate((prev) => addDays(prev, 7));
  };

  // Filter jobs for selected date (demo: showing all for now)
  const todaysJobs = scheduledJobs;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Schedule"
        subtitle={format(selectedDate, "MMMM yyyy")}
        actions={
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
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
                {/* Job indicator dots */}
                <div className="flex gap-0.5 mt-1">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground/60" : "bg-status-confirmed"
                    )}
                  />
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground/60" : "bg-status-pending"
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Jobs List */}
      <main className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {format(selectedDate, "EEEE, MMMM d")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {todaysJobs.length} jobs
          </span>
        </div>

        <div className="space-y-3">
          {todaysJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={() => navigate(`/jobs/${job.id}`)}
            />
          ))}
        </div>

        {todaysJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No jobs scheduled for this day</p>
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Schedule a Job
            </Button>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
