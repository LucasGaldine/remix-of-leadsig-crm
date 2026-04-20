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
    modifiers,
    onDayClick,
    onDayMouseEnter,
    onDayMouseLeave,
  }: {
    disabled?: (date: Date) => boolean;
    modifiers?: {
      mutedDeselected?: (date: Date) => boolean;
    };
    onDayClick?: (date: Date, activeModifiers: unknown, event: { buttons?: number }) => void;
    onDayMouseEnter?: (date: Date, activeModifiers: unknown, event: { buttons?: number }) => void;
    onDayMouseLeave?: (date: Date, activeModifiers: unknown, event: { buttons?: number }) => void;
  }) => {
    const target = new Date(2030, 0, 10);
    const altTarget = new Date(2030, 0, 11);
    const thirdTarget = new Date(2030, 0, 12);
    const isDisabled = disabled?.(target);
    const altMuted = modifiers?.mutedDeselected?.(altTarget) ?? false;

    return (
      <div>
        <div>{isDisabled ? "target-disabled" : "target-enabled"}</div>
        <div>{altMuted ? "alt-muted" : "alt-normal"}</div>
        <button type="button" onClick={() => onDayClick?.(target, {}, { buttons: 0 })}>
          Pick date
        </button>
        <button type="button" onClick={() => onDayClick?.(altTarget, {}, { buttons: 0 })}>
          Pick alt date
        </button>
        <button type="button" onClick={() => onDayClick?.(thirdTarget, {}, { buttons: 0 })}>
          Pick third date
        </button>
        <button type="button" onMouseEnter={() => onDayMouseEnter?.(target, {}, { buttons: 0 })}>
          Hover date
        </button>
        <button type="button" onMouseEnter={() => onDayMouseEnter?.(thirdTarget, {}, { buttons: 1 })}>
          Drag over third date
        </button>
        <button type="button" onMouseLeave={() => onDayMouseLeave?.(thirdTarget, {}, { buttons: 0 })}>
          Leave day
        </button>
      </div>
    );
  },
}));

describe("ScheduleDateBuilder availability guards", () => {
  it("disables full-capacity dates and blocks selecting them", () => {
    onSchedulesChangeMock.mockClear();
    toastErrorMock.mockClear();

    render(<ScheduleDateBuilder schedules={[]} onSchedulesChange={onSchedulesChangeMock} />);

    expect(screen.getByText("target-disabled")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /hover date/i }));
    expect(screen.getByText("Daily job limit (3) reached for this date.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pick date/i }));

    expect(screen.getByText(/No dates added/i)).toBeInTheDocument();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("toggles dates from the always-visible calendar and supports default plus per-date custom times", () => {
    const SchedulingHarness = () => {
      const [schedules, setSchedules] = useState<Array<{ date: string; timeStart: string; timeEnd: string }>>([]);
      return <ScheduleDateBuilder schedules={schedules} onSchedulesChange={setSchedules} />;
    };

    render(<SchedulingHarness />);

    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom times/i }));
    expect(screen.getByText("JAN")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();

    const defaultStartInput = screen.getByLabelText(/^start time$/i);
    const defaultEndInput = screen.getByLabelText(/^end time$/i);
    fireEvent.change(defaultStartInput, { target: { value: "09:00" } });
    fireEvent.change(defaultEndInput, { target: { value: "11:00" } });
    expect(defaultStartInput).toHaveValue("09:00");
    expect(defaultEndInput).toHaveValue("11:00");

    fireEvent.click(screen.getByRole("button", { name: /pick third date/i }));
    expect(screen.getByText("12")).toBeInTheDocument();

    const customTimesToggle = screen.getByRole("button", { name: /custom times/i });
    if (customTimesToggle.getAttribute("aria-expanded") === "false") {
      fireEvent.click(customTimesToggle);
    }
    fireEvent.click(screen.getAllByRole("button", { name: /set custom time/i })[0]);
    const customStartInput = screen.getByLabelText(/custom start time/i);
    const customEndInput = screen.getByLabelText(/custom end time/i);
    fireEvent.change(customStartInput, { target: { value: "10:00" } });
    fireEvent.change(customEndInput, { target: { value: "12:00" } });
    expect(customStartInput).toHaveValue("10:00");
    expect(customEndInput).toHaveValue("12:00");

    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    expect(screen.queryByText("11")).not.toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("supports drag-selecting additional dates", () => {
    const SchedulingHarness = () => {
      const [schedules, setSchedules] = useState<Array<{ date: string; timeStart: string; timeEnd: string }>>([]);
      return <ScheduleDateBuilder schedules={schedules} onSchedulesChange={setSchedules} />;
    };

    render(<SchedulingHarness />);

    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    fireEvent.mouseDown(window, { button: 0 });
    fireEvent.mouseEnter(screen.getByRole("button", { name: /drag over third date/i }));
    fireEvent.mouseUp(window, { button: 0 });
    fireEvent.mouseLeave(screen.getByRole("button", { name: /leave day/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom times/i }));

    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("allows selecting a date marked busy/full when ignoring existing-schedule constraints", () => {
    const SchedulingHarness = () => {
      const [schedules, setSchedules] = useState<Array<{ date: string; timeStart: string; timeEnd: string }>>([]);
      return (
        <ScheduleDateBuilder
          schedules={schedules}
          onSchedulesChange={setSchedules}
          ignoreExistingScheduleConstraints
        />
      );
    };

    render(<SchedulingHarness />);

    expect(screen.getByText("target-enabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pick date/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom times/i }));
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("does not mark a newly selected then deselected date as previously scheduled", () => {
    const SchedulingHarness = () => {
      const [schedules, setSchedules] = useState<Array<{ date: string; timeStart: string; timeEnd: string }>>([]);
      return <ScheduleDateBuilder schedules={schedules} onSchedulesChange={setSchedules} />;
    };

    render(<SchedulingHarness />);

    expect(screen.getByText("alt-normal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    fireEvent.click(screen.getByRole("button", { name: /pick alt date/i }));
    expect(screen.getByText("alt-normal")).toBeInTheDocument();
  });
});
