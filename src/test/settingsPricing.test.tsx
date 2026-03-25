import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPricing from "@/pages/SettingsPricing";

const { invokeMock, fromMock, toastErrorMock, toastSuccessMock, refreshProfileMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  refreshProfileMock: vi.fn(),
}));

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
    currentAccount: {
      id: "acct_1",
      company_name: "LeadSig Landscaping",
      pricing_plan: "free",
      pricing_tier: null,
    },
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

  it("changes plan through Stripe function instead of direct accounts update", async () => {
    render(
      <MemoryRouter>
        <SettingsPricing />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Upgrade to Basic/i }));
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
});
