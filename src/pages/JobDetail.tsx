import { useState, useEffect } from "react";
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
  Calendar,
  Edit,
  Trash2,
  MoreVertical,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useJob, useUpdateJob, useDeleteJob } from "@/hooks/useJobs";
import { useJobSchedules, useAddJobSchedule, useUpdateJobSchedule, useDeleteJobSchedule } from "@/hooks/useJobSchedules";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"details" | "checklist" | "photos" | "notes">("details");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    service_type: "",
    address: "",
    description: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
  });

  const { data: job, isLoading, error } = useJob(id);
  const { data: schedules = [], isLoading: schedulesLoading } = useJobSchedules(id);
  const addScheduleMutation = useAddJobSchedule();
  const updateScheduleMutation = useUpdateJobSchedule();
  const deleteScheduleMutation = useDeleteJobSchedule();
  const updateJobMutation = useUpdateJob();
  const deleteJobMutation = useDeleteJob();

  const [estimate, setEstimate] = useState<any>(null);
  const [estimateLoading, setEstimateLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEstimate();
    }
  }, [id]);

  const fetchEstimate = async () => {
    if (!id) return;

    setEstimateLoading(true);
    try {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, total, status, line_items:estimate_line_items(id)")
        .eq("job_id", id)
        .maybeSingle();

      if (error) throw error;
      setEstimate(data);
    } catch (error) {
      console.error("Error fetching estimate:", error);
    } finally {
      setEstimateLoading(false);
    }
  };

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
  const hasSchedules = schedules && schedules.length > 0;
  const scheduledDatesText = hasSchedules
    ? schedules.length === 1
      ? format(new Date(schedules[0].scheduled_date + "T00:00:00"), "EEEE, MMM d, yyyy")
      : `${schedules.length} scheduled dates`
    : "Not scheduled";

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

  const handleMarkComplete = async () => {
    if (!id) return;

    try {
      await updateJobMutation.mutateAsync({
        id,
        status: "completed"
      });
      toast.success("Job marked as complete!");
      setCompleteDialogOpen(false);
    } catch (error) {
      console.error("Error marking job as complete:", error);
      toast.error("Failed to mark job as complete");
    }
  };

  const openScheduleDialog = () => {
    setScheduleForm({
      scheduled_date: "",
      scheduled_time_start: "",
      scheduled_time_end: ""
    });
    setScheduleDialogOpen(true);
  };

  const handleSchedule = async () => {
    if (!id || !scheduleForm.scheduled_date) {
      toast.error("Please select a date");
      return;
    }

    try {
      await addScheduleMutation.mutateAsync({
        lead_id: id,
        scheduled_date: scheduleForm.scheduled_date,
        scheduled_time_start: scheduleForm.scheduled_time_start || undefined,
        scheduled_time_end: scheduleForm.scheduled_time_end || undefined,
      });

      toast.success("Schedule added successfully!");
      setScheduleForm({ scheduled_date: "", scheduled_time_start: "", scheduled_time_end: "" });
      setScheduleDialogOpen(false);
    } catch (error) {
      console.error("Error adding schedule:", error);
      toast.error("Failed to add schedule");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!id) return;

    try {
      await deleteScheduleMutation.mutateAsync({
        id: scheduleId,
        lead_id: id,
      });
      toast.success("Schedule removed!");
    } catch (error) {
      console.error("Error removing schedule:", error);
      toast.error("Failed to remove schedule");
    }
  };

  const openEditDialog = () => {
    setEditForm({
      name: job?.name || "",
      service_type: job?.service_type || "",
      address: job?.address || "",
      description: job?.description || "",
      customer_name: job?.customer?.name || "",
      customer_phone: job?.customer?.phone || "",
      customer_email: job?.customer?.email || "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!id) return;

    try {
      if (job?.customer?.id) {
        await supabase
          .from("customers")
          .update({
            name: editForm.customer_name.trim(),
            phone: editForm.customer_phone.trim() || null,
            email: editForm.customer_email.trim() || null,
            address: editForm.address.trim() || null,
          })
          .eq("id", job.customer.id);
      }

      await updateJobMutation.mutateAsync({
        id,
        name: editForm.name.trim() || null,
        service_type: editForm.service_type || null,
        address: editForm.address.trim() || null,
        description: editForm.description.trim() || null,
      });

      toast.success("Job updated successfully!");
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating job:", error);
      toast.error("Failed to update job");
    }
  };

  const deleteJob = async () => {
    if (!id) return;

    try {
      await deleteJobMutation.mutateAsync(id);
      toast.success("Job deleted successfully");
      navigate("/jobs");
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Failed to delete job");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Job Details" showBack backTo="/jobs" showNotifications={false} />

      {/* Status Banner */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={job.status} size="lg">
                {job.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </StatusBadge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Job
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {job.customer?.name || "Unknown Client"}
            </h2>
            <p className="text-muted-foreground">{job.service_type || job.name}</p>
          </div>
          <div className="text-right ml-4">
            <p className="text-2xl font-bold text-foreground">
              ${estimate?.total ? Number(estimate.total).toLocaleString() : (job.actual_value ? Number(job.actual_value).toLocaleString() : "0")}
            </p>
            <p className="text-xs text-muted-foreground">Estimate Total</p>
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
      <main className="px-4 py-4 pb-32">
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
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Clock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Schedule</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {scheduledDatesText}
                  </p>
                </div>
              </div>

              {schedulesLoading ? (
                <div className="flex justify-center py-2">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : hasSchedules ? (
                <div className="space-y-2 mb-3">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(schedule.scheduled_date + "T00:00:00"), "EEE, MMM d, yyyy")}
                        </p>
                        {schedule.scheduled_time_start && schedule.scheduled_time_end && (
                          <p className="text-xs text-muted-foreground">
                            {schedule.scheduled_time_start} - {schedule.scheduled_time_end}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                onClick={openScheduleDialog}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Schedule Date
              </Button>
            </div>

            {/* Estimate */}
            {estimate && (
              <button
                onClick={() => navigate(`/estimate/${estimate.id}`)}
                className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <DollarSign className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Estimate</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      ${Number(estimate.total).toLocaleString()} · {estimate.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {estimate.line_items?.length || 0} line items
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            )}

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
        <Button
          className="w-full h-14 text-base font-semibold"
          onClick={() => setCompleteDialogOpen(true)}
          disabled={job.status === "completed"}
        >
          {job.status === "completed" ? "Job Completed" : "Mark as Complete"}
        </Button>
      </div>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Job as Complete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this job as complete? This will update the job status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkComplete}>
              Mark Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule Date</DialogTitle>
            <DialogDescription>
              Add a new scheduled work date for this job. You can add multiple dates for multi-day projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">Scheduled Date *</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleForm.scheduled_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-start-time">Start Time</Label>
                <Input
                  id="schedule-start-time"
                  type="time"
                  value={scheduleForm.scheduled_time_start}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_time_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-end-time">End Time</Label>
                <Input
                  id="schedule-end-time"
                  type="time"
                  value={scheduleForm.scheduled_time_end}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_time_end: e.target.value })}
                />
              </div>
            </div>
            {scheduleForm.scheduled_date && (
              <div className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">
                {hasSchedules
                  ? "Adding additional scheduled date. Job status will update automatically based on all scheduled dates."
                  : "Job status will update automatically based on scheduled dates."}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule} disabled={!scheduleForm.scheduled_date}>
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Details</DialogTitle>
            <DialogDescription>
              Update job and customer information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Customer Info</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-customer-name">Customer Name</Label>
                <Input
                  id="edit-customer-name"
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-customer-phone">Phone</Label>
                  <Input
                    id="edit-customer-phone"
                    type="tel"
                    value={editForm.customer_phone}
                    onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-customer-email">Email</Label>
                  <Input
                    id="edit-customer-email"
                    type="email"
                    value={editForm.customer_email}
                    onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                    placeholder="john@email.com"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Job Details</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Job Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Smith Patio Project"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-service-type">Service Type</Label>
                <Select
                  value={editForm.service_type}
                  onValueChange={(v) => setEditForm({ ...editForm, service_type: v })}
                >
                  <SelectTrigger id="edit-service-type">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pavers / Patio">Pavers / Patio</SelectItem>
                    <SelectItem value="Concrete">Concrete</SelectItem>
                    <SelectItem value="Sod / Lawn">Sod / Lawn</SelectItem>
                    <SelectItem value="Deck">Deck</SelectItem>
                    <SelectItem value="Fencing">Fencing</SelectItem>
                    <SelectItem value="Retaining Wall">Retaining Wall</SelectItem>
                    <SelectItem value="Landscaping">Landscaping</SelectItem>
                    <SelectItem value="Hardscaping">Hardscaping</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Job Address</Label>
                <Input
                  id="edit-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="123 Main St, Austin, TX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Project scope and details..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be undone and will remove all associated data including the estimate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteJobMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteJob}
              disabled={deleteJobMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteJobMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
