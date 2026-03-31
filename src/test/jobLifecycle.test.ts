import { describe, expect, it } from "vitest";

import { isJobLifecycleStatus, toDisplayStatus } from "@/lib/jobLifecycle";

describe("jobLifecycle", () => {
  it("treats both legacy and current statuses as job records", () => {
    expect(isJobLifecycleStatus("job")).toBe(true);
    expect(isJobLifecycleStatus("completed")).toBe(true);
    expect(isJobLifecycleStatus("scheduled")).toBe(true);
    expect(isJobLifecycleStatus("in_progress")).toBe(true);
    expect(isJobLifecycleStatus("won")).toBe(true);
    expect(isJobLifecycleStatus("new")).toBe(false);
    expect(isJobLifecycleStatus("qualified")).toBe(false);
  });

  it("maps legacy status values to display status", () => {
    expect(toDisplayStatus("scheduled", [])).toBe("scheduled");
    expect(toDisplayStatus("in_progress", [])).toBe("in_progress");
    expect(toDisplayStatus("won", [])).toBe("completed");
    expect(toDisplayStatus("completed", [])).toBe("completed");
  });
});
