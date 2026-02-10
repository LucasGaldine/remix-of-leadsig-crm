import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import { JobCard } from "@/components/jobs/JobCard";
import { ListPageFilters } from "@/components/layout/ListPageFilters";
import { Briefcase } from "lucide-react";
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

  const jobs = useMemo(() => {
    if (selectedStatus === "all") return allJobs;
    if (selectedStatus === "no_crew") return allJobs.filter((job: any) => (job.crew_count || 0) === 0);
    return allJobs.filter((job: any) => {
      const displayStatus = job.display_status || job.status;
      return displayStatus === selectedStatus;
    });
  }, [allJobs, selectedStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allJobs.length,
      unscheduled: 0,
      scheduled: 0,
      in_progress: 0,
      completed: 0,
      paid: 0,
      no_crew: 0,
    };

    allJobs.forEach((job: any) => {
      const displayStatus = job.display_status || job.status;
      if (counts[displayStatus] !== undefined) {
        counts[displayStatus]++;
      }
      if ((job.crew_count || 0) === 0) {
        counts.no_crew++;
      }
    });

    return counts;
  }, [allJobs]);

  const statusTabs = [
    { value: "all", label: "All", count: statusCounts.all },
    { value: "unscheduled", label: "Unscheduled", count: statusCounts.unscheduled },
    { value: "no_crew", label: "Unassigned", count: statusCounts.no_crew },
    { value: "scheduled", label: "Scheduled", count: statusCounts.scheduled },
    { value: "in_progress", label: "In Progress", count: statusCounts.in_progress },
    { value: "completed", label: "Completed", count: statusCounts.completed },
    { value: "paid", label: "Paid", count: statusCounts.paid },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Jobs"
        subtitle={`$${revenue.toLocaleString()} collected this month`}
      />

      <ListPageFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search jobs..."
        tabs={statusTabs}
        activeTab={selectedStatus}
        onTabChange={setSelectedStatus}
      />

      <main className="px-4 py-4">
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
