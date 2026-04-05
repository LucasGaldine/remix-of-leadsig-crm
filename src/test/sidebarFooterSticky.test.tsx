import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarFooter } from "@/components/ui/sidebar";

describe("SidebarFooter", () => {
  it("keeps footer content pinned with sticky positioning", () => {
    render(
      <SidebarFooter data-testid="sidebar-footer">
        account summary
      </SidebarFooter>,
    );

    expect(screen.getByTestId("sidebar-footer")).toHaveClass("sticky");
    expect(screen.getByTestId("sidebar-footer")).toHaveClass("bottom-0");
  });
});
