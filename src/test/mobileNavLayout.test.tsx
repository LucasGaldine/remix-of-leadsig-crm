import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/layout/MobileNav";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isCrewMember: () => false,
  }),
}));

vi.mock("@/hooks/usePendingLeads", () => ({
  usePendingLeadsCount: () => ({
    data: 2,
  }),
}));

describe("MobileNav layout", () => {
  beforeEach(() => {
    window.localStorage.removeItem("mobile-nav:desktop-more-open");
  });

  it("renders desktop navigation as a left sidebar", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    const primaryNav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(primaryNav).toHaveClass("md:left-0");
    expect(primaryNav).toHaveClass("md:w-60");
    expect(primaryNav).toHaveClass("md:h-screen");
  });

  it("shows report a bug and settings actions in desktop footer", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /report an issue/i })).toBeInTheDocument();
    expect(screen.getByText(/^Settings$/i)).toBeInTheDocument();
  });

  it("renders Dashboard, Inbox, Calendar, CRM, and Financials as top-level nav items", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button", { name: /^Dashboard$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Inbox$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Calendar$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^CRM$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Financials$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^More$/i }).length).toBeGreaterThan(0);
  });

  it("includes Settings and Report an Issue in the mobile More dropdown", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    const moreButtons = screen.getAllByRole("button", { name: /^More$/i });
    fireEvent.keyDown(moreButtons[0], { key: "Enter", code: "Enter" });

    expect(screen.getByRole("menuitem", { name: /^Settings$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Report an Issue$/i })).toBeInTheDocument();
  });

  it("toggles CRM and Financials submenus in the mobile More dropdown one at a time", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    const moreButtons = screen.getAllByRole("button", { name: /^More$/i });
    fireEvent.keyDown(moreButtons[0], { key: "Enter", code: "Enter" });

    const menu = screen.getByRole("menu");
    const crmToggle = within(menu).getByRole("menuitem", { name: /^CRM$/i });
    const financialsToggle = within(menu).getByRole("menuitem", { name: /^Financials$/i });

    expect(crmToggle).toHaveAttribute("aria-expanded", "false");
    expect(financialsToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(menu).queryByText(/^Clients$/i)).not.toBeInTheDocument();
    expect(within(menu).queryByText(/^Payments$/i)).not.toBeInTheDocument();

    fireEvent.click(crmToggle);

    expect(crmToggle).toHaveAttribute("aria-expanded", "true");
    expect(financialsToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(menu).getByText(/^Clients$/i)).toBeInTheDocument();
    expect(within(menu).queryByText(/^Payments$/i)).not.toBeInTheDocument();

    fireEvent.click(financialsToggle);

    expect(crmToggle).toHaveAttribute("aria-expanded", "false");
    expect(financialsToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).queryByText(/^Clients$/i)).not.toBeInTheDocument();
    expect(within(menu).getByText(/^Payments$/i)).toBeInTheDocument();
  });

  it("does not render chevron arrow buttons on mobile", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /previous page/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next page/i })).not.toBeInTheDocument();
  });

  it("keeps CRM submenu pages hidden in desktop sidebar until CRM is opened", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/^Leads$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Clients$/i)).not.toBeInTheDocument();

    const crmButtons = screen.getAllByRole("button", { name: /^CRM$/i });
    expect(crmButtons[0]).toHaveAttribute("aria-haspopup", "menu");
  });
});
