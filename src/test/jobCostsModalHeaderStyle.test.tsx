import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCostsModal } from "@/components/jobs/JobCostsModal";

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: () => ({
    lineItems: [{ id: "li_1", name: "Mulch", quantity: 1, unit: "ea", unit_price: 120, total: 120, sort_order: 1, category: "materials", description: null }],
    isLoading: false,
    totalCost: 120,
    hasApprovedEstimate: true,
    resyncFromEstimate: { mutate: vi.fn(), isPending: false },
    updateEstimateFromJobCosts: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    addLineItem: { mutate: vi.fn(), mutateAsync: vi.fn() },
    updateLineItem: { mutate: vi.fn() },
    deleteLineItem: { mutate: vi.fn() },
  }),
}));

describe("JobCostsModal header total presentation", () => {
  it("removes the title icon and prefixes total with a minus sign", () => {
    render(<JobCostsModal jobId="job_1" open onOpenChange={() => {}} />);

    const title = screen.getByRole("heading", { name: /job costs/i });
    expect(title.querySelector("svg")).toBeNull();

    expect(screen.getByText(/^-\$120\.00$/)).toBeInTheDocument();
  });

  it("keeps quick action buttons inline in the header", () => {
    render(<JobCostsModal jobId="job_1" open onOpenChange={() => {}} />);

    const quickActions = screen.getByTestId("job-costs-modal-quick-actions");
    expect(quickActions).toHaveClass("flex");
    expect(quickActions).toHaveClass("items-center");
    expect(quickActions).toHaveClass("flex-nowrap");
    expect(quickActions.classList.contains("w-full")).toBe(false);
  });
});
