import { useState } from "react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Input } from "@/components/ui/input";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { Search, Bell, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type JobStatus = "all" | "scheduled" | "in_progress" | "completed" | "won" | "cancelled";

export default function Jobs() {
  const [selectedStatus, setSelectedStatus] = useState<JobStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const statusCounts = {
    all: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    won: 0,
    cancelled: 0,
  };

  const statusTabs: { value: JobStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "scheduled", label: "Scheduled" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "won", label: "Won" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const handleCreateJob = () => {
    console.log("Create job clicked");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">$0 collected this month</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-gray-600 hover:text-gray-900">
              <Bell className="h-5 w-5" />
            </button>
            <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-700">
              LG
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-gray-200 h-12"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={cn(
                "px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors flex-shrink-0",
                selectedStatus === tab.value
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {tab.label} {statusCounts[tab.value]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center py-32">
          <p className="text-gray-500 text-base">No jobs found</p>
        </div>
      </main>

      <FloatingActionButton
        actions={[
          {
            icon: <Briefcase className="h-5 w-5" />,
            label: "Create Job",
            onClick: handleCreateJob,
            primary: true,
          },
        ]}
      />

      <MobileNav />
    </div>
  );
}
