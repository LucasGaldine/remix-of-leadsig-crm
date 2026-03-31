import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LeadCard } from "@/components/leads/LeadCard";

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

describe("LeadCard actions", () => {
  const lead = {
    id: "lead_1",
    name: "Taylor Smith",
    phone: "",
    serviceType: "Lawn Care",
    estimatedBudget: 1200,
    location: "1 Main St, Miami",
    source: "Referral",
    createdAt: "2026-03-20T00:00:00.000Z",
    status: "new",
    customer: null,
  } as const;

  it("shows a popup message when call or text is tapped with no phone number", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    toastErrorMock.mockClear();

    render(
      <MemoryRouter>
        <LeadCard lead={lead as any} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(toastErrorMock).toHaveBeenCalledTimes(2);
    expect(toastErrorMock).toHaveBeenCalledWith("No phone number available for this lead.");
    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("uses the same compact badge layout as the jobs card for estimate value", () => {
    const { container } = render(
      <MemoryRouter>
        <LeadCard lead={lead as any} />
      </MemoryRouter>,
    );

    const valueLabel = screen.getByText("1,200");
    expect(valueLabel.className).toContain("whitespace-nowrap");

    const badge = valueLabel.closest("div.inline-flex");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("shrink-0");

    const icon = container.querySelector("svg.lucide-dollar-sign");
    expect(icon?.className.baseVal || "").toContain("flex-shrink-0");
  });
});
