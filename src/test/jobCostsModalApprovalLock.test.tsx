import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCostsModal } from "@/components/jobs/JobCostsModal";

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: () => ({
    lineItems: [
      {
        id: "li_1",
        name: "Mulch",
        quantity: 1,
        unit: "ea",
        unit_price: 120,
        total: 120,
        sort_order: 1,
        category: "materials",
        description: null,
      },
    ],
    isLoading: false,
    totalCost: 120,
    hasApprovedEstimate: false,
    resyncFromEstimate: { mutate: vi.fn(), isPending: false },
    updateEstimateFromJobCosts: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    addLineItem: { mutate: vi.fn(), mutateAsync: vi.fn() },
    updateLineItem: { mutate: vi.fn() },
    deleteLineItem: { mutate: vi.fn() },
  }),
}));

describe("JobCostsModal approval lock", () => {
  it("disables editing actions and explains why when estimate is not approved", () => {
    render(<JobCostsModal jobId="job_1" open onOpenChange={() => {}} />);

    expect(screen.getByText(/estimate must be approved before you can edit or resync job costs/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /estimate sync actions/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /scan receipt/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /add line item/i })).toBeDisabled();

    const editButtons = screen.getAllByRole("button", { name: /edit mulch/i });
    const deleteButtons = screen.getAllByRole("button", { name: /delete mulch/i });
    expect(editButtons.length).toBeGreaterThan(0);
    expect(deleteButtons.length).toBeGreaterThan(0);
    editButtons.forEach((button) => expect(button).toBeDisabled());
    deleteButtons.forEach((button) => expect(button).toBeDisabled());
  });
});
