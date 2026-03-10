import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { JobCard } from "@/components/jobs/JobCard";
import { ListPageFilters } from "@/components/layout/ListPageFilters";
import { Briefcase, Users, TriangleAlert as AlertTriangle, DollarSign } from "lucide-react";
import { useJobs, useJobRevenue } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";

export default function Jobs() {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);

  const filter = useMemo(() => ({
    searchQuery: searchQuery,
  }), [searchQuery]);

  const { data: allJobs = [], isLoading } = useJobs(filter);
  const { data: revenue = 0 } = useJobRevenue();

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const jobs = useMemo(() => {
    if (selectedStatus === "all") return allJobs;
    if (selectedStatus === "unassigned") {
      return allJobs.filter((job: any) => {
        const ds = job.display_status || job.status;
        return (job.crew_count || 0) === 0 &&
          (ds === "unscheduled" || ds === "scheduled" || ds === "in_progress");
      });
    }
    if (selectedStatus === "needs_invoice") {
      return allJobs.filter((job: any) =>
        job.status === "completed" && !job.has_invoice && !job.is_estimate_visit
      );
    }
    if (selectedStatus === "overdue") {
      return allJobs.filter((job: any) => {
        const lastDate = job.last_scheduled_date || job.scheduled_date;
        const ds = job.display_status || job.status;
        return lastDate && lastDate < today && ds !== "completed";
      });
    }
    return allJobs.filter((job: any) => {
      const displayStatus = job.display_status || job.status;
      return displayStatus === selectedStatus;
    });
  }, [allJobs, selectedStatus, today]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allJobs.length,
      unscheduled: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      unassigned: 0,
      needs_invoice: 0,
      overdue: 0,
    };

    allJobs.forEach((job: any) => {
      const displayStatus = job.display_status || job.status;
      if (counts[displayStatus] !== undefined) {
        counts[displayStatus]++;
      }
      if ((job.crew_count || 0) === 0 && (displayStatus === "unscheduled" || displayStatus === "scheduled" || displayStatus === "in_progress")) {
        counts.unassigned++;
      }
      if (job.status === "completed" && !job.has_invoice && !job.is_estimate_visit) {
        counts.needs_invoice++;
      }
      const lastDate = job.last_scheduled_date || job.scheduled_date;
      if (lastDate && lastDate < today && displayStatus !== "completed") {
        counts.overdue++;
      }
    });

    return counts;
  }, [allJobs, today]);

  const statusTabs = [
    { value: "all", label: "All", count: statusCounts.all },
    { value: "unscheduled", label: "Unscheduled", count: statusCounts.unscheduled },
    { value: "scheduled", label: "Scheduled", count: statusCounts.scheduled },
    { value: "in_progress", label: "In Progress", count: statusCounts.in_progress },
    { value: "completed", label: "Completed", count: statusCounts.completed },
  ];

  const hasAlertBadges = statusCounts.unassigned > 0 || statusCounts.needs_invoice > 0 || statusCounts.overdue > 0;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Jobs"
        subtitle={`$${revenue.toLocaleString()} collected this month`}
      />

      {hasAlertBadges && (
        <div className="p-4 pb-0 max-w-[var(--content-max-width)] m-auto">
          <div className="flex gap-2 flex-wrap">
            {statusCounts.unassigned > 0 && (
              <button
                onClick={() => setSelectedStatus(selectedStatus === "unassigned" ? "all" : "unassigned")}
                className="flex items-center gap-2
                 px-3 py-2
                rounded-lg
                text-sm font-medium
                border border-[hsl(var(--status-attention))]
                bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))]
                hover:opacity-80 transition-opacity
                levitate"
              >
                <Users className="h-4 w-4" />
                {statusCounts.unassigned} Unassigned
              </button>
            )}
            {statusCounts.needs_invoice > 0 && (
              <button
                onClick={() => setSelectedStatus(selectedStatus === "needs_invoice" ? "all" : "needs_invoice")}
                className="flex items-center gap-2
                 px-3 py-2
                rounded-lg
                text-sm font-medium
                border border-orange-300
                bg-orange-50 text-orange-700
                hover:opacity-80 transition-opacity
                levitate"
              >
                <DollarSign className="h-4 w-4" />
                {statusCounts.needs_invoice} Need{statusCounts.needs_invoice === 1 ? 's' : ''} Invoice
              </button>
            )}
            {statusCounts.overdue > 0 && (
              <button
                onClick={() => setSelectedStatus(selectedStatus === "overdue" ? "all" : "overdue")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))] text-sm font-medium hover:opacity-80 transition-opacity"
              >
                <AlertTriangle className="h-4 w-4" />
                {statusCounts.overdue} Overdue
              </button>
            )}
          </div>
        </div>
      )}


      <div className="p-4 pb-0 max-w-[var(--content-max-width)] m-auto">
      <ListPageFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search jobs..."
        tabs={statusTabs}
        activeTab={selectedStatus}
        onTabChange={setSelectedStatus}
        className="rounded-lg"
      />
      </div>

      <main className="px-4 py-4 max-w-[var(--content-max-width)] m-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? "No jobs match your search" : "No jobs found"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
            ))}
          </div>
        )}
      </main>

      {isManager() && (
        <FloatingActionButton
          actions={[
            {
              icon: <Briefcase className="h-5 w-5" />,
              label: "Create Job",
              onClick: () => setIsCreateJobOpen(true),
              primary: true,
            },
          ]}
        />
      )}

      <CreateJobDialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen} />
      <MobileNav />
    </div>
  );
}
