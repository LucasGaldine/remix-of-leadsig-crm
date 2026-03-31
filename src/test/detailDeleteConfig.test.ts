import { describe, expect, it } from "vitest";

import { getDetailDeleteConfig } from "@/lib/detailDeleteConfig";

describe("getDetailDeleteConfig", () => {
  it("returns lead delete copy and redirect path", () => {
    expect(getDetailDeleteConfig({ entity: "lead", name: "Acme Lead" })).toEqual({
      menuLabel: "Delete Lead",
      dialogTitle: "Delete Lead",
      dialogDescription: 'This will permanently delete "Acme Lead". This action cannot be undone.',
      successMessage: "Lead deleted successfully",
      redirectPath: "/leads",
    });
  });

  it("returns recurring job delete copy for job schedules", () => {
    expect(getDetailDeleteConfig({ entity: "job", name: "Weekly Mowing", isRecurring: true })).toEqual({
      menuLabel: "Delete Job Schedule",
      dialogTitle: "Delete Job Schedule",
      dialogDescription: 'This will permanently delete the recurring schedule for "Weekly Mowing" and all associated visits. This action cannot be undone.',
      successMessage: "Job schedule and all associated jobs deleted successfully",
      redirectPath: "/jobs",
    });
  });

  it("returns single job delete copy for normal jobs", () => {
    expect(getDetailDeleteConfig({ entity: "job", name: "Fence Repair", isRecurring: false })).toEqual({
      menuLabel: "Delete Job",
      dialogTitle: "Delete Job",
      dialogDescription: 'This will permanently delete "Fence Repair". This action cannot be undone.',
      successMessage: "Job deleted successfully",
      redirectPath: "/jobs",
    });
  });
});
