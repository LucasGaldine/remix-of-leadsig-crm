import { toast } from "sonner";
import { useAddJobSchedule, useDeleteJobSchedule, useUpdateJobSchedule } from "./useJobSchedules";

type ScheduleInput = {
  leadId: string;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
};

/**
 * Centralized scheduling helper shared across pages (Job detail, Lead detail, etc.)
 * Wraps the existing mutations from useJobSchedules and standardizes validation + toasts.
 */
export function useScheduleJob() {
  const addSchedule = useAddJobSchedule();
  const updateSchedule = useUpdateJobSchedule();
  const deleteSchedule = useDeleteJobSchedule();

  const scheduleJob = async (input: ScheduleInput) => {
    if (!input.leadId) {
      toast.error("Missing job id");
      return { ok: false, scheduleId: undefined };
    }
    if (!input.scheduledDate) {
      toast.error("Please select a date");
      return { ok: false, scheduleId: undefined };
    }

    try {
      const schedule = await addSchedule.mutateAsync({
        lead_id: input.leadId,
        scheduled_date: input.scheduledDate,
        scheduled_time_start: input.startTime || undefined,
        scheduled_time_end: input.endTime || undefined,
        notes: input.notes,
      });

      toast.success("Schedule added successfully!");
      return { ok: true, scheduleId: schedule.id };
    } catch (error) {
      console.error("Error adding schedule:", error);
      const message = error instanceof Error ? error.message : "Failed to add schedule";
      toast.error(message);
      return { ok: false, scheduleId: undefined, error: error as Error };
    }
  };

  return {
    scheduleJob,
    isScheduling: addSchedule.isPending,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
