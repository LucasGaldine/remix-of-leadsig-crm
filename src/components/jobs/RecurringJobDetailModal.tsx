import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Repeat, MoreVertical, Trash2, Edit, Unlink, Calendar, Clock, Users, MapPin } from "lucide-react";
import { useRecurringJob } from "@/hooks/useRecurringJobs";
import { useMakeJobUnique } from "@/hooks/useJobs";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface RecurringJobDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringJobId: string | null;
  jobId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onMadeUnique?: () => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurringJobDetailModal({
  open,
  onOpenChange,
  recurringJobId,
  jobId,
  onEdit,
  onDelete,
  onMadeUnique,
}: RecurringJobDetailModalProps) {
  const { data: recurringJob, isLoading } = useRecurringJob(recurringJobId || undefined);
  const makeUnique = useMakeJobUnique();
  const [makeUniqueDialogOpen, setMakeUniqueDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleMakeUnique = async () => {
    try {
      await makeUnique.mutateAsync(jobId);
      toast.success("Job detached from schedule");
      setMakeUniqueDialogOpen(false);
      onOpenChange(false);
      onMadeUnique?.();
    } catch (error) {
      console.error("Error making job unique:", error);
      toast.error("Failed to detach job from schedule");
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    setDeleteDialogOpen(false);
    onOpenChange(false);
    onDelete?.();
  };

  if (!recurringJobId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-emerald-600" />
                <DialogTitle>Job Schedule Details</DialogTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Schedule
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setMakeUniqueDialogOpen(true)}>
                    <Unlink className="h-4 w-4 mr-2" />
                    Make Unique
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recurringJob ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {recurringJob.name || "Unnamed Schedule"}
                </h3>
                {recurringJob.service_type && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {recurringJob.service_type}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Repeat className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Frequency</p>
                    <p className="text-sm text-muted-foreground">
                      {FREQUENCY_LABELS[recurringJob.frequency] || recurringJob.frequency}
                    </p>
                  </div>
                </div>

                {(recurringJob.frequency === "weekly" || recurringJob.frequency === "biweekly") &&
                  recurringJob.preferred_days_of_week &&
                  recurringJob.preferred_days_of_week.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Days of Week</p>
                        <div className="flex gap-1 mt-1">
                          {recurringJob.preferred_days_of_week.map((day) => (
                            <Badge key={day} variant="secondary" className="text-xs">
                              {DAYS_OF_WEEK[day]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                {recurringJob.frequency === "monthly" && recurringJob.preferred_day_of_month && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Day of Month</p>
                      <p className="text-sm text-muted-foreground">
                        {recurringJob.preferred_day_of_month}
                        {recurringJob.preferred_day_of_month === 1
                          ? "st"
                          : recurringJob.preferred_day_of_month === 2
                          ? "nd"
                          : recurringJob.preferred_day_of_month === 3
                          ? "rd"
                          : "th"}
                      </p>
                    </div>
                  </div>
                )}

                {(recurringJob.scheduled_time_start || recurringJob.scheduled_time_end) && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Time</p>
                      <p className="text-sm text-muted-foreground">
                        {recurringJob.scheduled_time_start || "Start"} -{" "}
                        {recurringJob.scheduled_time_end || "End"}
                      </p>
                    </div>
                  </div>
                )}

                {recurringJob.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Address</p>
                      <p className="text-sm text-muted-foreground">{recurringJob.address}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Date Range</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(recurringJob.start_date), "MMM d, yyyy")} -{" "}
                      {recurringJob.end_date
                        ? format(new Date(recurringJob.end_date), "MMM d, yyyy")
                        : "Ongoing"}
                    </p>
                  </div>
                </div>

                {recurringJob.default_crew_user_ids &&
                  recurringJob.default_crew_user_ids.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Default Crew</p>
                        <p className="text-sm text-muted-foreground">
                          {recurringJob.default_crew_user_ids.length} member(s) assigned
                        </p>
                      </div>
                    </div>
                  )}

                {recurringJob.description && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium text-foreground mb-1">Description</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {recurringJob.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Badge
                  variant={recurringJob.is_active ? "default" : "secondary"}
                  className={recurringJob.is_active ? "bg-emerald-600" : ""}
                >
                  {recurringJob.is_active ? "Active" : "Paused"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Schedule not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={makeUniqueDialogOpen} onOpenChange={setMakeUniqueDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make Job Unique</AlertDialogTitle>
            <AlertDialogDescription>
              This will detach this job from the recurring schedule, allowing you to modify its
              dates and details independently. The current date will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMakeUnique} disabled={makeUnique.isPending}>
              {makeUnique.isPending ? "Processing..." : "Make Unique"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This will not affect other jobs in the
              schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
