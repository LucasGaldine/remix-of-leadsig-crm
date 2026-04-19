import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("button", { name: /report a bug/i })).toBeInTheDocument();
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

  it("includes Settings and Report a Bug in the mobile More dropdown", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MobileNav />
      </MemoryRouter>,
    );

    const moreButtons = screen.getAllByRole("button", { name: /^More$/i });
    fireEvent.click(moreButtons[0]);

    expect(screen.getByText(/^Settings$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Report a Bug$/i)).toBeInTheDocument();
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
