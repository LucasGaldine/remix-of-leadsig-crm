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

// Demo job data
const jobData = {
  id: "1",
  clientName: "Johnson Residence",
  clientPhone: "(555) 123-4567",
  clientEmail: "johnson@email.com",
  clientAddress: "1234 Oak Street, Springfield, IL 62701",
  serviceType: "Patio Installation",
  scheduledDate: "Monday, January 13, 2025",
  scheduledTime: "8:00 AM - 12:00 PM",
  status: "in-progress" as const,
  crewLead: "Mike Thompson",
  crewMembers: ["Carlos Rodriguez", "James Wilson"],
  estimateValue: 8500,
  scope: "Install 400 sq ft paver patio with soldier course border. Customer selected Cambridge Cobble in Chestnut/Brown blend.",
  materials: [
    { name: "Cambridge Cobble Pavers", quantity: "45 pallets", checked: true },
    { name: "Polymeric Sand", quantity: "10 bags", checked: true },
    { name: "Edge Restraint", quantity: "120 ft", checked: false },
    { name: "Crushed Stone Base", quantity: "8 tons", checked: true },
  ],
  photos: {
    before: 2,
    during: 5,
    after: 0,
  },
  notes: [
    { time: "8:15 AM", text: "Arrived on site, met with homeowner", author: "Mike T." },
    { time: "9:30 AM", text: "Base prep complete, starting paver layout", author: "Mike T." },
  ],
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "photos" | "notes">("details");

  const handleCall = () => window.open(`tel:${jobData.clientPhone}`);
  const handleText = () => window.open(`sms:${jobData.clientPhone}`);
  const handleNavigate = () => {
    const address = encodeURIComponent(jobData.clientAddress);
    window.open(`https://maps.google.com/?q=${address}`);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Job Details" showBack backTo="/jobs" showNotifications={false} />

      {/* Status Banner */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <StatusBadge status={jobData.status} size="lg">
              In Progress
            </StatusBadge>
            <h2 className="text-xl font-bold text-foreground mt-2">
              {jobData.clientName}
            </h2>
            <p className="text-muted-foreground">{jobData.serviceType}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${jobData.estimateValue.toLocaleString()}
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
                    {jobData.clientAddress}
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
                    {jobData.scheduledDate}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {jobData.scheduledTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Crew */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <User className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Crew</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {jobData.crewLead} (Lead)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {jobData.crewMembers.join(", ")}
                  </p>
                </div>
              </div>
            </div>

            {/* Scope */}
            <div className="card-elevated rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <FileText className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Scope of Work</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {jobData.scope}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "checklist" && (
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground mb-3">Materials</h3>
            {jobData.materials.map((item, index) => (
              <button
                key={index}
                className="w-full card-elevated rounded-lg p-4 flex items-center gap-3 text-left hover:shadow-md transition-all"
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-md border-2 flex items-center justify-center",
                    item.checked
                      ? "bg-status-confirmed border-status-confirmed"
                      : "border-border"
                  )}
                >
                  {item.checked && (
                    <CheckSquare className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      "font-medium",
                      item.checked ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {item.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.quantity}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === "photos" && (
          <div className="space-y-4">
            {["Before", "During", "After"].map((phase) => {
              const key = phase.toLowerCase() as keyof typeof jobData.photos;
              const count = jobData.photos[key];
              return (
                <button
                  key={phase}
                  className="w-full card-elevated rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary">
                      <Camera className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">{phase} Photos</p>
                      <p className="text-sm text-muted-foreground">
                        {count} photo{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })}
            <Button className="w-full gap-2 mt-4">
              <Camera className="h-4 w-4" />
              Add Photo
            </Button>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-3">
            {jobData.notes.map((note, index) => (
              <div key={index} className="card-elevated rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {note.author}
                  </span>
                  <span className="text-sm text-muted-foreground">{note.time}</span>
                </div>
                <p className="text-sm text-muted-foreground">{note.text}</p>
              </div>
            ))}
            <Button variant="outline" className="w-full gap-2 mt-4">
              Add Note
            </Button>
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
