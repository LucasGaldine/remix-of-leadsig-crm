import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleDateTimePicker } from "@/components/scheduling/ScheduleDateTimePicker";

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect?.(new Date("2030-01-10"))}>
      pick date
    </button>
  ),
}));

describe("ScheduleDateTimePicker", () => {
  it("renders date and time controls without modal-specific heading or footer actions", () => {
    const onSelectDate = vi.fn();

    render(
      <ScheduleDateTimePicker
        selectedDate={undefined}
        onSelectDate={onSelectDate}
        calendarMonth={new Date("2030-01-01")}
        onCalendarMonthChange={vi.fn()}
        disabledDate={() => false}
        scheduledTimeStart=""
        onScheduledTimeStartChange={vi.fn()}
        scheduledTimeEnd=""
        onScheduledTimeEndChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "pick date" }));
    expect(onSelectDate).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText("Start Time")).toBeInTheDocument();
    expect(screen.getByLabelText("End Time")).toBeInTheDocument();
    expect(screen.queryByText("Schedule Date & Time")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Schedule" })).not.toBeInTheDocument();
  });
});
