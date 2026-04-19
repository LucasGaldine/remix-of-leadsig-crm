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

  it("shows the company logo inside the client portal preview when a logo is configured", () => {
    mockCurrentAccount.logo_url = "https://example.com/logo.png";

    render(
      <MemoryRouter>
        <SettingsCompanyProfile />
      </MemoryRouter>,
    );

    const previewCard = screen.getByRole("heading", { name: "Client Portal Preview" }).closest("div");
    expect(previewCard).not.toBeNull();

    const previewLogo = screen.getAllByRole("img", { name: "LeadSig Landscaping" })
      .find((image) => image.className.includes("h-10"));

    expect(previewLogo).toBeDefined();
    expect(previewLogo).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("uses the portal text color on the preview pay invoice button", () => {
    render(
      <MemoryRouter>
        <SettingsCompanyProfile />
      </MemoryRouter>,
    );

    const payInvoiceButton = screen.getByRole("button", { name: "Pay Invoice" });

    expect(payInvoiceButton).toHaveStyle({
      backgroundColor: "#334155",
      color: "#ffffff",
    });
  });

  it("keeps the client portal preview constrained to the card width", () => {
    render(
      <MemoryRouter>
        <SettingsCompanyProfile />
      </MemoryRouter>,
    );

    const previewContainer = screen.getByTestId("client-portal-preview-container");
    expect(previewContainer).toHaveClass("w-full");
    expect(previewContainer).not.toHaveClass("w-screen");
  });
});
