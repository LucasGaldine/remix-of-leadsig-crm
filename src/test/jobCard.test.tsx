import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { JobCard } from "@/components/jobs/JobCard";

vi.mock("@/components/jobs/RecurringJobDetailModal", () => ({
  RecurringJobDetailModal: () => null,
}));

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
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
          job={{
            ...job,
            phone: "5551234567",
            customer: {
              ...job.customer,
              phone: "5551234567",
            },
          }}
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

  it("keeps status badges right-aligned and uses mobile-friendly header padding", () => {
    const { container } = render(
      <MemoryRouter>
        <JobCard
          job={{
            ...job,
            status: "unscheduled",
            display_status: "unscheduled",
            crew_count: 0,
          }}
        />
      </MemoryRouter>,
    );

    const topRow = container.querySelector("div.flex.justify-between");
    expect(topRow?.className).toContain("px-4");
    expect(topRow?.className).toContain("sm:px-8");
    expect(topRow?.className).toContain("items-end");

    const rightBadges = container.querySelector("div.flex.items-end.gap-2.flex-wrap");
    expect(rightBadges?.className).toContain("justify-end");
    expect(rightBadges?.className).toContain("ml-auto");
  });

  it("keeps 'Not scheduled' date label on a single line", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...job,
            scheduled_date: undefined,
            last_scheduled_date: undefined,
            status: "unscheduled",
            display_status: "unscheduled",
          }}
        />
      </MemoryRouter>,
    );

    const notScheduled = screen.getByText("Not scheduled");
    expect(notScheduled.className).toContain("whitespace-nowrap");
  });

  it("shows unassigned badge when at least one scheduled day has no crew assignment", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...job,
            status: "scheduled",
            display_status: "scheduled",
            crew_count: 1,
            has_unassigned_schedule: true,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("uses built-in tel/sms fallback when custom handlers are not provided", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onClick = vi.fn();

    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...job,
            phone: "(555) 987-6543",
            customer: {
              ...job.customer,
              phone: "(555) 987-6543",
            },
          }}
          onClick={onClick}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /call/i }));
    fireEvent.click(screen.getByRole("button", { name: /message/i }));

    expect(windowOpenSpy).toHaveBeenCalledWith("tel:5559876543");
    expect(windowOpenSpy).toHaveBeenCalledWith("sms:5559876543");
    expect(onClick).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it("shows a popup message when call or text is tapped with no phone number", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    toastErrorMock.mockClear();

    render(
      <MemoryRouter>
        <JobCard
          job={{
            ...job,
            phone: "",
            customer: {
              ...job.customer,
              phone: "",
            },
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /call/i }));
    fireEvent.click(screen.getByRole("button", { name: /message/i }));

    expect(toastErrorMock).toHaveBeenCalledTimes(2);
    expect(toastErrorMock).toHaveBeenCalledWith("No phone number available for this job.");
    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });
});
