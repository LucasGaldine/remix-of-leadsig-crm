import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LeadCard } from "@/components/leads/LeadCard";

describe("LeadCard", () => {
  const lead = {
    id: "lead_1",
    name: "Taylor Smith",
    phone: "",
    serviceType: "Lawn Care",
    estimatedBudget: 1200,
    location: "1 Main St, Miami",
    source: "Referral",
    createdAt: "Apr 11",
    status: "new",
    customer: null,
  } as const;

  it("renders the unified row layout content", () => {
    render(
      <MemoryRouter>
        <LeadCard lead={lead as any} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Taylor Smith")).toBeInTheDocument();
    expect(screen.getByText("Apr 11 | Lawn Care")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("triggers onClick when selected", () => {
    const onClick = vi.fn();

    render(
      <MemoryRouter>
        <LeadCard lead={lead as any} onClick={onClick} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
