import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobCosts } from "@/components/jobs/JobCosts";

vi.mock("@/hooks/useJobLineItems", () => ({
  useJobLineItems: () => ({
    lineItems: [{ id: "li_1", name: "Mulch", cost: 120 }],
    isLoading: false,
    totalCost: 120,
  }),
}));

vi.mock("@/components/jobs/JobCostsModal", () => ({
  JobCostsModal: () => null,
}));

describe("JobCosts card style", () => {
  it("uses the invoice card shell style and negative sign treatment", () => {
    render(<JobCosts jobId="job_1" />);

    const card = screen.getByRole("button", { name: /costs/i });

    expect(card.className).toContain("rounded-2xl");
    expect(card.className).toContain("border");
    expect(card.className).toContain("border-border");
    expect(card.className).toContain("bg-card");
    expect(card.className).toContain("p-5");
    expect(card.className).toContain("shadow-sm");
    expect(card.className).not.toContain("card-elevated");
    expect(screen.getByText(/^-\$120\.00$/)).toBeInTheDocument();
    expect(card.querySelector("svg.lucide-receipt")).toBeNull();
    expect(card.querySelector("svg.lucide-chevron-right")).toBeNull();
  });
});
