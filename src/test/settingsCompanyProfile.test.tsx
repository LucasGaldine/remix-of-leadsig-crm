import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mockCurrentAccount = {
  id: "acct_1",
  company_name: "LeadSig Landscaping",
  company_email: "hello@example.com",
  company_phone: "555-1234",
  company_address: "1 Main St",
  billing_email: "billing@example.com",
  website: "https://example.com",
  invite_code: "TEAM123",
  logo_url: null as string | null,
  settings: {
    client_portal_color: "#123456",
    client_portal_text_color: "#f0f0f0",
    client_portal_highlight_color: "#ff9900",
  },
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: mockCurrentAccount,
    refreshProfile: vi.fn(),
  }),
}));

describe("SettingsCompanyProfile logo uploader", () => {
  beforeEach(() => {
    mockCurrentAccount.logo_url = null;
  });

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

  it("does not render the client portal preview section", () => {
    mockCurrentAccount.logo_url = "https://example.com/logo.png";

    render(
      <MemoryRouter>
        <SettingsCompanyProfile />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("heading", { name: /client portal preview/i })).not.toBeInTheDocument();
  });

  it("renders brand color controls with saved values", () => {
    render(
      <MemoryRouter>
        <SettingsCompanyProfile />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/^Brand Color$/i, { selector: "input" })).toHaveValue("#123456");
    expect(screen.getByLabelText(/^Brand Text Color$/i, { selector: "input" })).toHaveValue("#f0f0f0");
    expect(screen.getByLabelText(/^Highlight Color$/i, { selector: "input" })).toHaveValue("#ff9900");
    expect(screen.getByLabelText(/Brand color swatch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Brand text color swatch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Highlight color swatch/i)).toBeInTheDocument();
  });
});
