import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCostsModal } from "@/components/jobs/JobCostsModal";

const longDescription = "Topsoil delivery, grading, compaction, and cleanup with extra hauling fees. ".repeat(6).trim();

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: () => ({
    lineItems: [
      {
        id: "li_1",
        name: "Landscape Prep",
        description: longDescription,
        quantity: 1,
        unit: "ea",
        unit_price: 1200,
        total: 1200,
        sort_order: 1,
        category: "materials",
      },
    ],
    isLoading: false,
    totalCost: 1200,
    resyncFromEstimate: { mutate: vi.fn(), isPending: false },
    addLineItem: { mutate: vi.fn(), mutateAsync: vi.fn() },
    updateLineItem: { mutate: vi.fn() },
    deleteLineItem: { mutate: vi.fn() },
  }),
}));

describe("JobCostsModal description truncation", () => {
  it("clamps long descriptions to 3 lines and expands on View more", () => {
    render(<JobCostsModal jobId="job_1" open onOpenChange={() => {}} />);

    const viewMoreButtons = screen.getAllByRole("button", { name: /view more/i });
    expect(viewMoreButtons.length).toBeGreaterThan(0);

    const descriptionNodesBefore = screen.getAllByText(longDescription);
    expect(descriptionNodesBefore.some((node) => node.className.includes("line-clamp-3"))).toBe(true);

    fireEvent.click(viewMoreButtons[0]);

    expect(screen.getAllByRole("button", { name: /view less/i }).length).toBeGreaterThan(0);
    const descriptionNodesAfter = screen.getAllByText(longDescription);
    expect(descriptionNodesAfter.some((node) => !node.className.includes("line-clamp-3"))).toBe(true);
  });
});
