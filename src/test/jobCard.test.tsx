import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { JobCard } from "@/components/jobs/JobCard";

vi.mock("@/components/jobs/RecurringJobDetailModal", () => ({
  RecurringJobDetailModal: () => null,
}));

describe("JobCard actions", () => {
  const job = {
    id: "job_1",
    name: "Front Yard Cleanup",
    status: "scheduled",
    display_status: "scheduled",
    crew_count: 1,
    scheduled_date: "2026-03-25",
    last_scheduled_date: "2026-03-25",
    address: "123 Main St",
    city: "New York",
    service_type: "Cleanup",
    is_estimate_visit: false,
    estimate_total: 500,
    has_invoice: false,
    customer: {
      id: "cust_1",
      name: "Jane Doe",
    },
  } as any;

  it("fires action handlers without triggering card click", () => {
    const onClick = vi.fn();
    const onCall = vi.fn();
    const onMessage = vi.fn();
    const onNavigate = vi.fn();

    render(
      <MemoryRouter>
        <JobCard
          job={job}
          onClick={onClick}
          onCall={onCall}
          onMessage={onMessage}
          onNavigate={onNavigate}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /call/i }));
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /message/i }));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /navigate/i }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not add extra bottom margin on the status row", () => {
    const { container } = render(
      <MemoryRouter>
        <JobCard job={job} />
      </MemoryRouter>,
    );

    const statusRowWithMargin = container.querySelector("div.flex.items-center.gap-2.mb-1.flex-wrap");
    expect(statusRowWithMargin).toBeNull();
  });
});
