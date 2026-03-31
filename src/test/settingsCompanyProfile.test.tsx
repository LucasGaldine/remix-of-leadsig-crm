import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import SettingsCompanyProfile from "@/pages/SettingsCompanyProfile";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/settings/StickyActionBar", () => ({
  StickyActionBar: () => null,
}));

vi.mock("@/components/settings/UnsavedChangesDialog", () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock("@/hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: () => null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: {
      id: "acct_1",
      company_name: "LeadSig Landscaping",
      company_email: "hello@example.com",
      company_phone: "555-1234",
      company_address: "1 Main St",
      billing_email: "billing@example.com",
      website: "https://example.com",
      invite_code: "TEAM123",
      logo_url: null,
    },
    refreshProfile: vi.fn(),
  }),
}));

describe("SettingsCompanyProfile logo uploader", () => {
  it("renders a custom upload control instead of the native full-width file input", () => {
    render(
      <MemoryRouter>
        <SettingsCompanyProfile />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Upload Logo/i })).toBeInTheDocument();
    expect(screen.getByText(/No file selected/i)).toBeInTheDocument();

    const fileInput = screen.getByLabelText(/Company Logo/i);
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveClass("sr-only");
  });
});
