import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JoinSkoolModal } from "@/components/modals/JoinSkoolModal";

describe("JoinSkoolModal", () => {
  it("shows free-access copy for free accounts", () => {
    render(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
        plan="free"
        tier={null}
      />,
    );

    expect(screen.getByText(/includes free access to the skool community/i)).toBeInTheDocument();
  });

  it("shows premium-access copy for essentials growth and pro", () => {
    const { rerender } = render(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
        plan="basic"
        tier="growth"
      />,
    );

    expect(screen.getByText(/unlocked premium skool access/i)).toBeInTheDocument();

    rerender(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
        plan="premium"
        tier={null}
      />,
    );

    expect(screen.getByText(/unlocked premium skool access/i)).toBeInTheDocument();
  });

  it("renders the Skool logo in the modal header", () => {
    render(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
        plan="free"
        tier={null}
      />,
    );

    expect(screen.getByRole("img", { name: /skool logo/i })).toBeInTheDocument();
  });
});
