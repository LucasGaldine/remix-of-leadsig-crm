import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FloatingActionButton } from "@/components/layout/FloatingActionButton";

describe("FloatingActionButton stacking", () => {
  it("keeps the single-action button below modal layers", () => {
    render(
      <FloatingActionButton
        actions={[
          {
            icon: <span aria-hidden="true">+</span>,
            label: "Create",
            onClick: vi.fn(),
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "Create" });
    expect(button.className).toContain("z-[40]");
  });

  it("keeps the multi-action menu and backdrop below modal layers", () => {
    render(
      <FloatingActionButton
        actions={[
          {
            icon: <span aria-hidden="true">A</span>,
            label: "Action A",
            onClick: vi.fn(),
          },
          {
            icon: <span aria-hidden="true">B</span>,
            label: "Action B",
            onClick: vi.fn(),
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    const menuContainer = screen.getByRole("button", { name: /close menu/i }).parentElement;
    expect(menuContainer?.className).toContain("z-[40]");

    const backdrop = document.querySelector("div.backdrop-blur-sm");
    expect(backdrop?.className).toContain("z-[35]");
  });
});
