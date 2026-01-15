import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Clock,
  User,
  Phone,
  MessageSquare,
  Navigation,
  Camera,
  CheckSquare,
  FileText,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useJob } from "@/hooks/useJobs";
import { format } from "date-fns";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "photos" | "notes">("details");

  const { data: job, isLoading, error } = useJob(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader title="Job Details" showBack backTo="/jobs" showNotifications={false} />
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Job not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  const clientPhone = job.customer?.phone || "";
  const clientAddress = job.address || "";
  const scheduledDate = job.scheduled_date
    ? format(new Date(job.scheduled_date), "EEEE, MMMM d, yyyy")
    : "Not scheduled";
  const scheduledTime = job.scheduled_time_start && job.scheduled_time_end
    ? `${job.scheduled_time_start} - ${job.scheduled_time_end}`
    : "Time not set";

  const handleCall = () => {
    if (clientPhone) window.open(`tel:${clientPhone}`);
  };

  const handleText = () => {
    if (clientPhone) window.open(`sms:${clientPhone}`);
  };

  const handleNavigate = () => {
    if (clientAddress) {
      const address = encodeURIComponent(clientAddress);
      window.open(`https://maps.google.com/?q=${address}`);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Job Details" showBack backTo="/jobs" showNotifications={false} />

      {/* Status Banner */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <StatusBadge status={job.status} size="lg">
              {job.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </StatusBadge>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {job.customer?.name || "Unknown Client"}
            </h2>
            <p className="text-muted-foreground">{job.service_type || job.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${job.estimated_value ? Number(job.estimated_value).toLocaleString() : "0"}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handleCall}
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={handleText}
          >
            <MessageSquare className="h-4 w-4" />
            Text
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleNavigate}
          >
            <Navigation className="h-4 w-4" />
            Navigate
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 overflow-x-auto scrollbar-hide">
        <div className="flex">
          {[
            { id: "details", label: "Details" },
            { id: "checklist", label: "Checklist" },
            { id: "photos", label: "Photos" },
            { id: "notes", label: "Notes" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-touch whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <main className="px-4 py-4">
        {activeTab === "details" && (
          <div className="space-y-4">
            {/* Location */}
            <button
              onClick={handleNavigate}
              className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <MapPin className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Job Location</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {clientAddress || "No address provided"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>

            {/* Schedule */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Clock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Schedule</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {scheduledDate}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {scheduledTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Crew */}
            {job.crew_lead && (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Crew Lead</p>
                    <p className="text-sm text-foreground mt-0.5">
                      {job.crew_lead?.full_name || "Assigned"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Description/Notes */}
            {(job.description || job.notes) && (
              <div className="card-elevated rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <FileText className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {job.description ? "Description" : "Notes"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.description || job.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "checklist" && (
          <div className="space-y-2">
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No checklist items yet</p>
              <Button variant="outline">Add Checklist Item</Button>
            </div>
          </div>
        )}

        {activeTab === "photos" && (
          <div className="space-y-4">
            <div className="text-center py-12">
              <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No photos yet</p>
              <Button className="gap-2">
                <Camera className="h-4 w-4" />
                Add Photo
              </Button>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-3">
            {job.notes ? (
              <>
                <div className="card-elevated rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">{job.notes}</p>
                </div>
                <Button variant="outline" className="w-full gap-2">
                  Edit Note
                </Button>
              </>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No notes yet</p>
                <Button variant="outline" className="w-full gap-2">
                  Add Note
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <Button className="w-full h-14 text-base font-semibold">
          Mark as Complete
        </Button>
      </div>

      <MobileNav />
    </div>
  );
}
