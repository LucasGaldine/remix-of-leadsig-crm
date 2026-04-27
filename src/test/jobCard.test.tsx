import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { JobCard } from "@/components/jobs/JobCard";

describe("JobCard", () => {
  const baseJob = {
    id: "job_1",
    name: "Front Yard Cleanup",
    status: "scheduled",
    display_status: "scheduled",
    scheduled_date: "2026-03-25",
    last_scheduled_date: "2026-03-25",
    service_type: "Cleanup",
    is_estimate_visit: false,
    has_invoice: false,
    has_unassigned_schedule: false,
    customer: {
      id: "cust_1",
      name: "Jane Doe",
    },
  } as any;

  it("renders unified layout details", () => {
    render(
      <MemoryRouter>
        <JobCard job={baseJob} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/Cleanup/)).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("shows unassigned when schedule has no crew", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...baseJob,
            has_unassigned_schedule: true,
            status: "scheduled",
            display_status: "scheduled",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("prioritizes unscheduled over unassigned when no dates exist", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...baseJob,
            has_unassigned_schedule: true,
            status: "job",
            display_status: "unscheduled",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    expect(screen.getByText("Unscheduled")).toBeInTheDocument();
  });

  it("hides unassigned status when disabled by parent context", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...baseJob,
            has_unassigned_schedule: true,
            status: "scheduled",
            display_status: "scheduled",
          }}
          hideUnassignedStatus
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("shows needs invoice on completed jobs without invoices", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...baseJob,
            status: "completed",
            display_status: "completed",
            has_invoice: false,
            is_estimate_visit: false,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Needs Invoice")).toBeInTheDocument();
  });

  it("triggers onClick when selected", () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <JobCard job={baseJob} onClick={onClick} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
