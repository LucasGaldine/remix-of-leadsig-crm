import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Calendar } from "@/components/ui/calendar";

describe("Calendar disabled-day hover support", () => {
  it("keeps pointer events enabled on disabled day buttons", () => {
    const { container } = render(
      <Calendar
        mode="single"
        month={new Date(2030, 0, 1)}
        selected={new Date(2030, 0, 10)}
        disabled={() => true}
      />,
    );

    expect(container.innerHTML).toContain("disabled:pointer-events-auto");
  });
});
