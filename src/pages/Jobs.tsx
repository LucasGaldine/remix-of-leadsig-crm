import { useState } from "react";
import { Search, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { JobCard, Job, JobStatus } from "@/components/jobs/JobCard";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

// Demo data
const allJobs: Job[] = [
  {
    id: "1",
    clientName: "Johnson Residence",
    clientAddress: "1234 Oak Street, Springfield",
    serviceType: "Patio Installation",
    scheduledTime: "Today, 8:00 AM",
    status: "in-progress",
    crewLead: "Mike Thompson",
    estimateValue: 8500,
  },
  {
    id: "2",
    clientName: "Anderson Property",
    clientAddress: "567 Maple Ave, Riverside",
    serviceType: "Retaining Wall",
    scheduledTime: "Today, 1:00 PM",
    status: "scheduled",
    crewLead: "Carlos Rodriguez",
    estimateValue: 12000,
  },
  {
    id: "3",
    clientName: "Williams Family",
    clientAddress: "890 Pine Road, Lakewood",
    serviceType: "Pool Deck",
    scheduledTime: "Tomorrow, 9:00 AM",
    status: "scheduled",
    crewLead: "Mike Thompson",
    estimateValue: 18500,
  },
  {
    id: "4",
    clientName: "Garcia Home",
    clientAddress: "234 Cedar Lane, Oak Park",
    serviceType: "Fire Pit Area",
    scheduledTime: "Jan 10",
    status: "completed",
    estimateValue: 6800,
  },
  {
    id: "5",
    clientName: "Martinez Backyard",
    clientAddress: "567 Elm Street, Downtown",
    serviceType: "Walkway Installation",
    scheduledTime: "Jan 8",
    status: "invoiced",
    estimateValue: 4200,
  },
  {
    id: "6",
    clientName: "Thompson Estate",
    clientAddress: "123 Birch Ave, Riverside",
    serviceType: "Full Landscape",
    scheduledTime: "Jan 5",
    status: "paid",
    estimateValue: 32000,
  },
];

type FilterStatus = "all" | JobStatus;

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
];

export default function Jobs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [showAddJob, setShowAddJob] = useState(false);

  const filteredJobs = allJobs.filter((job) => {
    const matchesSearch =
      job.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.clientAddress.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === "all" || job.status === activeFilter;

    return matchesSearch && matchesFilter;
  });

  // Calculate revenue
  const totalRevenue = allJobs
    .filter((j) => j.status === "paid")
    .reduce((sum, j) => sum + (j.estimateValue || 0), 0);

  const pendingRevenue = allJobs
    .filter((j) => ["completed", "invoiced"].includes(j.status))
    .reduce((sum, j) => sum + (j.estimateValue || 0), 0);

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
