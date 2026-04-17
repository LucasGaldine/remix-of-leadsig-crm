import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPricing from "@/pages/SettingsPricing";

type MockAccount = {
  id: string;
  company_name: string;
  pricing_plan: "free" | "basic" | "premium";
  pricing_tier: "solo" | "team" | "growth" | null;
};

const { invokeMock, fromMock, toastErrorMock, toastSuccessMock, refreshProfileMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  refreshProfileMock: vi.fn(),
}));

let mockCurrentAccount: MockAccount;

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: mockCurrentAccount,
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    from: fromMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

describe("SettingsPricing", () => {
  beforeEach(() => {
    mockCurrentAccount = {
      id: "acct_1",
      company_name: "LeadSig Landscaping",
      pricing_plan: "free",
      pricing_tier: null,
    };

    invokeMock.mockReset();
    fromMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    refreshProfileMock.mockReset();

    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    fromMock.mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    });
  });

  it("shows correct monthly prices for basic tiers and premium", () => {
    render(
      <MemoryRouter>
        <SettingsPricing />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("$29").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$497").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+ \$3,000 one-time setup fee/i).length).toBeGreaterThan(0);

    const basicTierSelect = screen.getAllByLabelText(/basic tier/i)[0];
    fireEvent.change(basicTierSelect, { target: { value: "growth" } });

    expect(screen.getAllByText("$197").length).toBeGreaterThan(0);
  });

  it("allows switching basic tier when current plan is basic", async () => {
    mockCurrentAccount = {
      id: "acct_1",
      company_name: "LeadSig Landscaping",
      pricing_plan: "basic",
      pricing_tier: "solo",
    };

    render(
      <MemoryRouter>
        <SettingsPricing />
      </MemoryRouter>,
    );

    const basicCard = screen.getAllByText("Essentials")[0].closest("div[class*='rounded-xl']");
    expect(basicCard).not.toBeNull();

    const basicTierSelect = within(basicCard as HTMLElement).getByLabelText(/basic tier/i);
    fireEvent.change(basicTierSelect, { target: { value: "team" } });

    fireEvent.click(screen.getAllByRole("button", { name: /Switch to Team/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("stripe-manage-subscription", {
        body: expect.objectContaining({
          targetPlan: "basic",
          targetTier: "team",
        }),
      });
    });
  });

  it("changes plan through Stripe function instead of direct accounts update", async () => {
    render(
      <MemoryRouter>
        <SettingsPricing />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Upgrade to Essentials/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("stripe-manage-subscription", {
        body: expect.objectContaining({
          targetPlan: "basic",
        }),
      });
    });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("sends a 14-day trial when onboarding selects basic", async () => {
    window.history.pushState({}, "", "/settings/pricing?onboarding=1&trial=14&defaultPlan=basic");

    render(
      <MemoryRouter>
        <SettingsPricing />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Upgrade to Essentials/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("stripe-manage-subscription", {
        body: expect.objectContaining({
          targetPlan: "basic",
          trialDays: 14,
        }),
      });
    });
  });

  it("shows a visible trial banner during pricing onboarding", () => {
    window.history.pushState({}, "", "/settings/pricing?onboarding=1&trial=14&defaultPlan=basic");

    render(
      <MemoryRouter>
        <SettingsPricing />
      </MemoryRouter>,
    );

    expect(screen.getByText(/14-day free trial for Essentials/i)).toBeInTheDocument();
  });
});
