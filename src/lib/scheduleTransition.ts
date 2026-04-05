export type CalendarTransitionIntent = "previous" | "next";
export type CalendarTransitionDirection = "forward" | "backward" | "idle";
export type CalendarTransitionPhase = "enter" | "exit";

export function getCalendarTransitionDirection(
  intent: CalendarTransitionIntent,
): CalendarTransitionDirection {
  return intent === "next" ? "forward" : "backward";
}

export function getCalendarTransitionPhase(
  direction: CalendarTransitionDirection,
  phase: CalendarTransitionPhase,
): string {
  if (direction === "idle") {
    return "";
  }

  return `calendar-swap-${phase}-${direction}`;
}
