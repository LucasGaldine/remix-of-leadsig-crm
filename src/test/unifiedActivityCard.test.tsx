import { render, screen } from "@testing-library/react";
import { ChevronRight } from "lucide-react";
import { describe, expect, it } from "vitest";

import { UnifiedActivityCard } from "@/components/activity/UnifiedActivityCard";

describe("UnifiedActivityCard", () => {
  it("does not force icon-only sizing for labeled quick actions", () => {
    render(
      <UnifiedActivityCard
        icon={<ChevronRight />}
        title="Dashboard Job"
        subtitle="Today"
        statusLabel="Scheduled"
        quickActions={[
          {
            label: "Start Job",
            icon: <ChevronRight />,
            showLabel: true,
            size: "xxl",
            variant: "secondary",
          },
        ]}
      />,
    );

    const action = screen.getByRole("button", { name: "Start Job" });
    expect(action).toHaveClass("h-12");
    expect(action).not.toHaveClass("h-8");
    expect(action).not.toHaveClass("w-8");
  });
});
