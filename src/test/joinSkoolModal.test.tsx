import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JoinSkoolModal } from "@/components/modals/JoinSkoolModal";

describe("JoinSkoolModal", () => {
  it("shows unified free-access copy", () => {
    render(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText(/includes free access to our private skool community/i)).toBeInTheDocument();
    expect(screen.getByText(/step-by-step training, implementation playbooks/i)).toBeInTheDocument();
  });

  it("renders the Skool logo in the modal header", () => {
    render(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByRole("img", { name: /skool logo/i })).toBeInTheDocument();
  });

  it("uses the default elo join link and button label", () => {
    render(
      <JoinSkoolModal
        open
        onOpenChange={() => {}}
      />,
    );

    const joinButton = screen.getByRole("link", { name: /join now/i });
    expect(joinButton).toHaveAttribute("href", "https://www.skool.com/elo");
  });
});
