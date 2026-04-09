import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCosts } from "@/components/jobs/JobCosts";

const mockUseJobLineItems = vi.fn();

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: (...args: unknown[]) => mockUseJobLineItems(...args),
}));

vi.mock("@/components/jobs/JobCostsModal", () => ({
  JobCostsModal: ({ open }: { open: boolean }) => (
    <div data-testid="job-costs-modal-state">{open ? "open" : "closed"}</div>
  ),
}));

describe("JobCosts empty state interactions", () => {
  it("opens the job costs modal even when there are no line items", () => {
    mockUseJobLineItems.mockReturnValue({
      lineItems: [],
      isLoading: false,
      totalCost: 0,
      hasApprovedEstimate: false,
    });

    render(<JobCosts jobId="job_1" />);

    const card = screen.getByRole("button", { name: /costs/i });
    expect(screen.getByTestId("job-costs-modal-state")).toHaveTextContent("closed");

    fireEvent.click(card);

    expect(screen.getByTestId("job-costs-modal-state")).toHaveTextContent("open");
  });
});
