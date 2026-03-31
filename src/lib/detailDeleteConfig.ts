type DetailDeleteEntity = "lead" | "job";

interface DetailDeleteConfigInput {
  entity: DetailDeleteEntity;
  name: string;
  isRecurring?: boolean;
}

interface DetailDeleteConfig {
  menuLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  successMessage: string;
  redirectPath: string;
}

export function getDetailDeleteConfig({
  entity,
  name,
  isRecurring = false,
}: DetailDeleteConfigInput): DetailDeleteConfig {
  if (entity === "lead") {
    return {
      menuLabel: "Delete Lead",
      dialogTitle: "Delete Lead",
      dialogDescription: `This will permanently delete "${name}". This action cannot be undone.`,
      successMessage: "Lead deleted successfully",
      redirectPath: "/leads",
    };
  }

  if (isRecurring) {
    return {
      menuLabel: "Delete Job Schedule",
      dialogTitle: "Delete Job Schedule",
      dialogDescription: `This will permanently delete the recurring schedule for "${name}" and all associated visits. This action cannot be undone.`,
      successMessage: "Job schedule and all associated jobs deleted successfully",
      redirectPath: "/jobs",
    };
  }

  return {
    menuLabel: "Delete Job",
    dialogTitle: "Delete Job",
    dialogDescription: `This will permanently delete "${name}". This action cannot be undone.`,
    successMessage: "Job deleted successfully",
    redirectPath: "/jobs",
  };
}
