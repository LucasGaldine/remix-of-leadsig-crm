import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailEstimateCard } from "@/components/shared/DetailEstimateCard";

describe("DetailEstimateCard", () => {
  it("renders status, amount, line items and CTA using the job detail card style", () => {
    const { container } = render(
      <DetailEstimateCard
        label="Estimate"
        status="draft"
        total={2688}
        lineItemCount={1}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText("Estimate")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("$2,688.00")).toBeInTheDocument();
    expect(screen.getByText("1 line item")).toBeInTheDocument();
    expect(screen.getByText("View Details")).toBeInTheDocument();

    const cardButton = container.querySelector("button");
    expect(cardButton?.className).toContain("rounded-2xl");
    expect(cardButton?.className).toContain("border");
    expect(cardButton?.className).toContain("p-5");
  });

  it("shows 'Starting at' when requested", () => {
    render(
      <DetailEstimateCard
        label="Estimate"
        status="draft"
        total={1344}
        lineItemCount={1}
        showStartingAt
        onClick={() => {}}
      />,
    );

    expect(screen.getByText("Starting at")).toBeInTheDocument();
    expect(screen.getByText("$1,344.00")).toBeInTheDocument();
  });
});
