import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

let authStateChangeHandler: ((event: string, session: any) => void) | null = null;
const accountMembersSelectMock = vi.fn();

const membershipsData = [
  {
    account_id: "old-account",
    role: "owner",
    is_active: true,
    accounts: {
      id: "old-account",
      company_name: "Old Company",
      company_email: null,
      company_phone: null,
      company_address: null,
      billing_email: null,
      website: null,
      logo_url: null,
      settings: null,
      invite_code: "OLDCODE",
      pricing_plan: "basic",
      pricing_tier: "growth",
      default_tax_rate: 0,
      default_profit_margin: 0,
      default_surcharge: 0,
    },
  },
];

vi.mock("@/integrations/supabase/client", () => {
  const supabase = {
    auth: {
      onAuthStateChange: vi.fn((handler: (event: string, session: any) => void) => {
        authStateChangeHandler = handler;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "profile-1",
                  user_id: "old-user",
                  full_name: "Old User",
                },
              }),
            })),
          })),
        };
      }

      if (table === "account_members") {
        return {
          select: accountMembersSelectMock.mockImplementation(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: membershipsData }),
              })),
            })),
          })),
        };
      }

      if (table === "account_entitlements") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    account_id: "old-account",
                    status: "active",
                    entitlement_key: "leadsig_growth",
                  },
                ],
              }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase };
});

import { AuthProvider, useAuth } from "@/hooks/useAuth";

function AuthStateProbe() {
  const { role, currentAccount } = useAuth();

  return (
    <>
      <div data-testid="role">{role ?? "none"}</div>
      <div data-testid="account-id">{currentAccount?.id ?? "none"}</div>
    </>
  );
}

describe("useAuth account pairing", () => {
  it("requests pricing_tier when loading account membership data", async () => {
    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await act(async () => {
      authStateChangeHandler?.("SIGNED_IN", { user: { id: "old-user" } });
    });

    await waitFor(() => {
      expect(accountMembersSelectMock).toHaveBeenCalled();
    });

    expect(accountMembersSelectMock.mock.calls[0][0]).toContain("pricing_tier");
  });

  it("falls back to the first active membership when stored account id is stale", async () => {
    localStorage.setItem("currentAccountId", "deleted-account");

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await act(async () => {
      authStateChangeHandler?.("SIGNED_IN", { user: { id: "old-user" } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("owner");
    });

    expect(screen.getByTestId("account-id")).toHaveTextContent("old-account");
    expect(localStorage.getItem("currentAccountId")).toBe("old-account");
  });
});
