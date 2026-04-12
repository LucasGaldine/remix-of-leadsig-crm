import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";

vi.mock("@/components/leads/AddLeadDialog", () => ({
  AddLeadDialog: ({ open, onLeadCreated }: { open: boolean; onLeadCreated?: (leadId: string) => void }) =>
    open ? (
      <button type="button" onClick={() => onLeadCreated?.("lead-123")}>
        trigger-lead-created
      </button>
    ) : null,
}));

vi.mock("@/components/jobs/CreateJobDialog", () => ({
  CreateJobDialog: ({ open, onJobCreated }: { open: boolean; onJobCreated?: (jobId: string) => void }) =>
    open ? (
      <button type="button" onClick={() => onJobCreated?.("job-123")}>
        trigger-job-created
      </button>
    ) : null,
}));

describe("MainPageQuickActions callbacks", () => {
  it("forwards lead and job created callbacks from dialogs", () => {
    const onLeadCreated = vi.fn();
    const onJobCreated = vi.fn();

    render(<MainPageQuickActions onLeadCreated={onLeadCreated} onJobCreated={onJobCreated} />);

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /add lead/i }));
    fireEvent.click(screen.getByText("trigger-lead-created"));

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /add job/i }));
    fireEvent.click(screen.getByText("trigger-job-created"));

    expect(onLeadCreated).toHaveBeenCalledWith("lead-123");
    expect(onJobCreated).toHaveBeenCalledWith("job-123");
  });
});
