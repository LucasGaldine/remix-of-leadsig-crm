import { describe, expect, it } from "vitest";

import {
  getCalendarTransitionDirection,
  getCalendarTransitionPhase,
  type CalendarTransitionDirection,
} from "@/lib/scheduleTransition";

describe("scheduleTransition", () => {
  it("maps previous and next actions to directional transition classes", () => {
    expect(getCalendarTransitionDirection("previous")).toBe("backward");
    expect(getCalendarTransitionDirection("next")).toBe("forward");
  });

  it("returns stable phase classes for each direction", () => {
    const expectations: Array<{
      direction: CalendarTransitionDirection;
      enter: string;
      exit: string;
    }> = [
      {
        direction: "forward",
        enter: "calendar-swap-enter-forward",
        exit: "calendar-swap-exit-forward",
      },
      {
        direction: "backward",
        enter: "calendar-swap-enter-backward",
        exit: "calendar-swap-exit-backward",
      },
      {
        direction: "idle",
        enter: "",
        exit: "",
      },
    ];

    expectations.forEach(({ direction, enter, exit }) => {
      expect(getCalendarTransitionPhase(direction, "enter")).toBe(enter);
      expect(getCalendarTransitionPhase(direction, "exit")).toBe(exit);
    });
  });
});
