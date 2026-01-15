import { useState } from "react";
import { Search, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { JobCard } from "@/components/jobs/JobCard";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useJobs } from "@/hooks/useJobs";
import { Database } from "@/integrations/supabase/types";

type JobStatus = Database["public"]["Enums"]["unified_status"];
type FilterStatus = "all" | JobStatus;

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "won", label: "Won" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Jobs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [showAddJob, setShowAddJob] = useState(false);

  const { data: allJobs = [], isLoading } = useJobs({ limit: 100 });

  const filteredJobs = allJobs.filter((job) => {
    const customerName = job.customer?.name || "";
    const address = job.address || job.customer?.address || "";
    const serviceType = job.service_type || "";

    const matchesSearch =
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === "all" || job.status === activeFilter;

    return matchesSearch && matchesFilter;
  });

  // Calculate revenue
  const totalRevenue = allJobs
    .filter((j) => j.status === "won")
    .reduce((sum, j) => sum + (Number(j.actual_value) || Number(j.estimated_value) || 0), 0);

  const pendingRevenue = allJobs
    .filter((j) => ["completed"].includes(j.status))
    .reduce((sum, j) => sum + (Number(j.actual_value) || Number(j.estimated_value) || 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Jobs"
        subtitle={`$${totalRevenue.toLocaleString()} collected this month`}
      />

      {/* Search */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-card border-b border-border overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {filterOptions.map((option) => {
            const count =
              option.value === "all"
                ? allJobs.length
                : allJobs.filter((j) => j.status === option.value).length;

            return (
              <button
                key={option.value}
                onClick={() => setActiveFilter(option.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-touch",
                  activeFilter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "text-2xs px-1.5 py-0.5 rounded-full",
                    activeFilter === option.value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Revenue Summary */}
      {pendingRevenue > 0 && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-status-pending-bg border border-status-pending/20">
          <p className="text-sm font-medium text-status-pending">
            ${pendingRevenue.toLocaleString()} pending collection
          </p>
        </div>
      )}

      {/* Jobs List */}
      <main className="px-4 py-4">
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={() => navigate(`/jobs/${job.id}`)}
            />
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No jobs found</p>
          </div>
        )}
      </main>

      <FloatingActionButton
        actions={[
          {
            icon: <Briefcase className="h-5 w-5" />,
            label: "Create Job",
            onClick: () => setShowAddJob(true),
            primary: true,
          },
        ]}
      />

      <AddJobDialog
        open={showAddJob}
        onOpenChange={setShowAddJob}
        onJobCreated={(jobId) => {
          navigate(`/jobs/${jobId}`);
        }}
      />

      <MobileNav />
    </div>
  );
}
