import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleDateBuilder } from "@/components/scheduling/ScheduleDateBuilder";

const { onSchedulesChangeMock, toastErrorMock } = vi.hoisted(() => ({
  onSchedulesChangeMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      busyDatesSet: new Set(["2030-01-10"]),
      dayOffDatesSet: new Set<string>(),
      dayOffReasonsByDate: {},
      fullyBookedDatesSet: new Set(["2030-01-10"]),
      existingCountsByDate: { "2030-01-10": 3 },
      dailyLimit: 3,
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    disabled,
    onSelect,
    onDayMouseEnter,
  }: {
    disabled?: (date: Date) => boolean;
    onSelect?: (date: Date) => void;
    onDayMouseEnter?: (date: Date) => void;
  }) => {
    const target = new Date(2030, 0, 10);
    const altTarget = new Date(2030, 0, 11);
    const thirdTarget = new Date(2030, 0, 12);
    const isDisabled = disabled?.(target);

    return (
      <div>
        <div>{isDisabled ? "target-disabled" : "target-enabled"}</div>
        <button type="button" onClick={() => onSelect?.(target)}>
          Pick date
        </button>
        <button type="button" onClick={() => onSelect?.(altTarget)}>
          Pick alt date
        </button>
        <button type="button" onClick={() => onSelect?.(thirdTarget)}>
          Pick third date
        </button>
        <button type="button" onMouseEnter={() => onDayMouseEnter?.(target)}>
          Hover date
        </button>
      </div>
    );
  },
}));

describe("ScheduleDateBuilder availability guards", () => {
  it("disables full-capacity dates and blocks adding them", () => {
    onSchedulesChangeMock.mockClear();
    toastErrorMock.mockClear();

    render(<ScheduleDateBuilder schedules={[]} onSchedulesChange={onSchedulesChangeMock} />);

    fireEvent.click(screen.getByRole("button", { name: /view calendar/i }));
    expect(screen.getByText("target-disabled")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /hover date/i }));
    expect(screen.getByText("Daily job limit (3) reached for this date.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pick date/i }));
    fireEvent.click(screen.getByRole("button", { name: /add schedule date/i }));

    expect(onSchedulesChangeMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Daily job limit has been reached for this date.");
  });

  it("adds schedules only on check click and clears date/time fields after saving", () => {
    const SchedulingHarness = () => {
      const [schedules, setSchedules] = useState<Array<{ date: string; timeStart: string; timeEnd: string }>>([]);
      return <ScheduleDateBuilder schedules={schedules} onSchedulesChange={setSchedules} />;
    };

    render(<SchedulingHarness />);

    fireEvent.click(screen.getByRole("button", { name: /view calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    fireEvent.click(screen.getByRole("button", { name: /add schedule date/i }));
    expect(screen.getByText(/Jan 11, 2030/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date$/i)).toHaveValue("");
    expect(screen.getByLabelText(/start time/i)).toHaveValue("");
    expect(screen.getByLabelText(/end time/i)).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: /view calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /pick third date/i }));
    fireEvent.click(screen.getByRole("button", { name: /add schedule date/i }));
    expect(screen.getByText(/Jan 12, 2030/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 11, 2030/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date$/i)).toHaveValue("");
    expect(screen.getByLabelText(/start time/i)).toHaveValue("");
    expect(screen.getByLabelText(/end time/i)).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: /add schedule date/i }));
    fireEvent.click(screen.getByRole("button", { name: /view calendar/i }));
    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    fireEvent.click(screen.getByRole("button", { name: /add schedule date/i }));
    expect(screen.getByText(/Jan 12, 2030/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/Jan 11, 2030/i).length).toBeGreaterThan(0);
  });
});
