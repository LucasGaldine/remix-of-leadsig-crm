import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Settings from "@/pages/Settings";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/auth/TwoFactorSetup", () => ({
  TwoFactorSetup: () => null,
}));

vi.mock("@/components/layout/BugReportModal", () => ({
  BugReportModal: ({ open }: { open: boolean }) => (
    <div data-testid="bug-report-modal">{open ? "open" : "closed"}</div>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    profile: { full_name: "Taylor Smith", email: "taylor@example.com" },
    role: "owner",
    currentAccount: { pricing_plan: "basic" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

function renderSettings(initialEntry = "/settings") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Settings bug report search", () => {
  it("finds report a bug from settings search", () => {
    renderSettings();

    fireEvent.change(screen.getByPlaceholderText("Search settings..."), {
      target: { value: "bug" },
    });

    expect(screen.getByRole("button", { name: /report a bug/i })).toBeInTheDocument();
  });

  it("finds company profile from client portal search terms", () => {
    renderSettings();

    fireEvent.change(screen.getByPlaceholderText("Search settings..."), {
      target: { value: "client portal" },
    });

    expect(screen.getByRole("button", { name: /company profile/i })).toBeInTheDocument();
  });

  it("opens report a bug modal from the reportBug query param", () => {
    renderSettings("/settings?reportBug=1");

    expect(screen.getByTestId("bug-report-modal")).toHaveTextContent("open");
  });
});
