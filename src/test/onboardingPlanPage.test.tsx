import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPlan from "@/pages/OnboardingPlan";
import { ONBOARDING_PLAN_STORAGE_KEY } from "@/lib/onboarding";

const navigateMock = vi.fn();
const { invokeMock, refreshProfileMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  refreshProfileMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
    createElement("header", null, createElement("h1", null, title), subtitle ? createElement("p", null, subtitle) : null),
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
  },
}));

describe("OnboardingPlan page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    invokeMock.mockReset();
    refreshProfileMock.mockReset();
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    window.localStorage.removeItem(ONBOARDING_PLAN_STORAGE_KEY);
  });

  it("completes onboarding and routes to dashboard", () => {
    render(<OnboardingPlan />);

    fireEvent.click(screen.getByRole("button", { name: /Complete onboarding/i }));

    expect(window.localStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY)).toBe("completed");
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("uses the same upgrade flow as settings pricing", async () => {
    render(<OnboardingPlan />);

    fireEvent.click(screen.getAllByRole("button", { name: /Upgrade to Pro/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("stripe-manage-subscription", {
        body: expect.objectContaining({
          accountId: "acct_1",
          targetPlan: "premium",
        }),
      });
    });
  });
});
