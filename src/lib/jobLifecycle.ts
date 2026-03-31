type ScheduleLike = {
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
};

const JOB_LIFECYCLE_STATUSES = new Set([
  "job",
  "scheduled",
  "in_progress",
  "completed",
  "won",
  "invoiced",
  "paid",
]);

const COMPLETED_STATUSES = new Set(["completed", "won", "invoiced", "paid"]);

export function isJobLifecycleStatus(status: string | null | undefined): boolean {
  return !!status && JOB_LIFECYCLE_STATUSES.has(status);
}

export function toDisplayStatus(
  status: string | null | undefined,
  schedules: ScheduleLike[],
): "unscheduled" | "scheduled" | "in_progress" | "completed" {
  if (COMPLETED_STATUSES.has(status || "")) return "completed";
  if (status === "in_progress") return "in_progress";
  if (status === "scheduled") return "scheduled";

  if (status === "job" && schedules.length > 0) {
    const sortedSchedules = [...schedules].sort((a, b) => {
      const dateCompare = (a.scheduled_date || "").localeCompare(b.scheduled_date || "");
      if (dateCompare !== 0) return dateCompare;
      if (!a.scheduled_time_start) return 1;
      if (!b.scheduled_time_start) return -1;
      return a.scheduled_time_start.localeCompare(b.scheduled_time_start);
    });

    const earliestSchedule = sortedSchedules[0];
    const latestSchedule = sortedSchedules[sortedSchedules.length - 1];

    const now = new Date();
    const firstDateTime = new Date(
      `${earliestSchedule.scheduled_date}T${earliestSchedule.scheduled_time_start || "00:00:00"}`,
    );
    const lastDateTime = new Date(
      `${latestSchedule.scheduled_date}T${latestSchedule.scheduled_time_end || "23:59:59"}`,
    );

    if (now > lastDateTime) return "completed";
    if (now >= firstDateTime && now <= lastDateTime) return "in_progress";
    return "scheduled";
  }

  return "unscheduled";
}
