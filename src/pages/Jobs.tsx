import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";
import { JobCard } from "@/components/jobs/JobCard";
import { ArrowUpDown, Users, TriangleAlert as AlertTriangle, DollarSign, Building2, User, Check, Search, Briefcase } from "lucide-react";
import { useJobs, useJobRevenue } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sortJobItems, type JobSortOption } from "@/lib/pageSorting";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Jobs() {
  const navigate = useNavigate();
  const { isManager, role } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<JobSortOption>("newest");
  const [showMyJobsOnly, setShowMyJobsOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem('jobs-view-preference');
    return saved === 'my-jobs';
  });

  useEffect(() => {
    localStorage.setItem('jobs-view-preference', showMyJobsOnly ? 'my-jobs' : 'all-jobs');
  }, [showMyJobsOnly]);

  const canViewAllJobs = role === 'owner' || role === 'admin' || role === 'sales';

  const filter = useMemo(() => ({
    searchQuery: searchQuery,
    myJobsOnly: canViewAllJobs ? showMyJobsOnly : true,
  }), [searchQuery, showMyJobsOnly, canViewAllJobs]);

  const { data: allJobs = [], isLoading } = useJobs(filter);
  const { data: revenue = 0 } = useJobRevenue();

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const jobs = useMemo(() => {
    let filteredJobs = allJobs;

    if (selectedStatus === "all") {
      return sortJobItems(filteredJobs, sortBy);
    }

    if (selectedStatus === "unassigned") {
      filteredJobs = allJobs.filter((job: any) => {
        const ds = job.display_status || job.status;
        return Boolean(job.has_unassigned_schedule) &&
          (ds === "unscheduled" || ds === "scheduled" || ds === "in_progress");
      });
      return sortJobItems(filteredJobs, sortBy);
    }
    if (selectedStatus === "needs_invoice") {
      filteredJobs = allJobs.filter((job: any) =>
        job.status === "completed" && !job.has_invoice && !job.is_estimate_visit
      );
      return sortJobItems(filteredJobs, sortBy);
    }
    if (selectedStatus === "overdue") {
      filteredJobs = allJobs.filter((job: any) => {
        const lastDate = job.last_scheduled_date || job.scheduled_date;
        const ds = job.display_status || job.status;
        return lastDate && lastDate < today && ds !== "completed";
      });
      return sortJobItems(filteredJobs, sortBy);
    }
    filteredJobs = allJobs.filter((job: any) => {
      const displayStatus = job.display_status || job.status;
      return displayStatus === selectedStatus;
    });
    return sortJobItems(filteredJobs, sortBy);
  }, [allJobs, selectedStatus, sortBy, today]);

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
      if (job.has_unassigned_schedule && (displayStatus === "unscheduled" || displayStatus === "scheduled" || displayStatus === "in_progress")) {
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
  const jobSortOptions: Array<{ value: JobSortOption; label: string }> = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "scheduled_soonest", label: "Scheduled soonest" },
    { value: "scheduled_latest", label: "Scheduled latest" },
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
  ];

  const hasAlertBadges = statusCounts.unassigned > 0 || statusCounts.needs_invoice > 0 || statusCounts.overdue > 0;

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Jobs"
        subtitle={`$${revenue.toLocaleString()} collected this month`}
        hideTitle
      />

      {canViewAllJobs && (
        <div className="p-4 pb-0 max-w-[var(--content-max-width)] m-auto hidden">
          <div className="flex gap-2">
            <Button
              variant={!showMyJobsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMyJobsOnly(false)}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              All Jobs
            </Button>
            <Button
              variant={showMyJobsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMyJobsOnly(true)}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              My Jobs
            </Button>
          </div>
        </div>
      )}

      {hasAlertBadges && (
        <div className="p-4 pb-0 max-w-[var(--content-max-width)] m-auto">
          <div className="flex gap-2 flex-wrap">
            {statusCounts.unassigned > 0 && (
              <button
                onClick={() => setSelectedStatus(selectedStatus === "unassigned" ? "all" : "unassigned")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg 
                border border-[hsl(var(--status-attention))]
                bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))] 
                text-sm font-medium 
                shadow-sm hover:shadow-md
                hover:text-[hsl(var(--status-attention-bg))] hover:bg-[hsl(var(--status-attention))] 
                transition-all"
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg 
                border border-[hsl(var(--status-attention))]
                bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention))] 
                text-sm font-medium 
                shadow-sm hover:shadow-md
                hover:text-[hsl(var(--status-attention-bg))] hover:bg-[hsl(var(--status-attention))] 
                transition-all"
              >
                <AlertTriangle className="h-4 w-4" />
                {statusCounts.overdue} Overdue
              </button>
            )}
          </div>
        </div>
      )}
      <div className="max-w-[var(--content-max-width)] m-auto p-4">
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search jobs..."
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Sort jobs">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {jobSortOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setSortBy(option.value)}>
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                        {sortBy === option.value ? <Check className="h-4 w-4" /> : null}
                      </span>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-4 pt-2 pb-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max">
              {statusTabs.map((tab) => {
                const isActive = selectedStatus === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setSelectedStatus(tab.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-xs", isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 pt-5 pb-3 border-t border-border">
            <div className="inline-flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Jobs</p>
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 pb-6">
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="px-4 pb-6">
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {searchQuery ? "No jobs match your search." : "No jobs found."}
              </div>
            </div>
          ) : (
            <div>
              {jobs.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className={cn(
                    "rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:bg-accent/40",
                    index > 0 && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border",
                  )}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <MainPageQuickActions show={isManager()} />
      <MobileNav />
    </div>
  );
}
