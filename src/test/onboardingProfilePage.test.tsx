import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingProfile from "@/pages/OnboardingProfile";
import { ONBOARDING_PROFILE_STORAGE_KEY } from "@/lib/onboarding";

const navigateMock = vi.fn();
const refreshProfileMock = vi.fn();
const startStripeOnboardingMock = vi.fn();
let mockedDefaultTaxRate = 8;
let mockedDefaultProfitMargin = 0;
let mockedDefaultSurcharge = 0;
let pricingRulesRows: Array<{ user_id: string; account_id: string; service_type: string }> = [];

const mockCrewProfiles: Array<{ id: string; full_name: string; role: "crew_lead" | "crew_member" }> = [];

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1" },
    currentAccount: {
      id: "acct_1",
      invite_code: "ABC123",
      logo_url: null,
      default_tax_rate: mockedDefaultTaxRate,
      default_profit_margin: mockedDefaultProfitMargin,
      default_surcharge: mockedDefaultSurcharge,
      settings: {
        client_portal_color: "#334155",
        client_portal_text_color: "#0f172a",
      },
    },
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock("@/hooks/useStripeConnect", () => ({
  useStripeConnect: () => ({
    status: { connected: false },
    loading: false,
    connecting: false,
    startOnboarding: startStripeOnboardingMock,
  }),
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
    createElement("header", null, createElement("h1", null, title), subtitle ? createElement("p", null, subtitle) : null),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "mock_crew_profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [...mockCrewProfiles], error: null }),
            }),
          }),
          insert: async (payload: { full_name: string; role: "crew_lead" | "crew_member" }) => {
            mockCrewProfiles.unshift({
              id: `mock_${mockCrewProfiles.length + 1}`,
              full_name: payload.full_name,
              role: payload.role,
            });
            return { error: null };
          },
          delete: () => ({
            eq: (column: string, value: string) => {
              if (column === "id") {
                const index = mockCrewProfiles.findIndex((profile) => profile.id === value);
                if (index >= 0) {
                  mockCrewProfiles.splice(index, 1);
                }
              }
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      if (table === "accounts") {
        return {
          update: (payload: Record<string, unknown>) => {
            if ("default_tax_rate" in payload) {
              mockedDefaultTaxRate = Number(payload.default_tax_rate);
              mockedDefaultProfitMargin = Number(payload.default_profit_margin);
              mockedDefaultSurcharge = Number(payload.default_surcharge);
            }

            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "pricing_rules") {
        return {
          select: () => ({
            eq: (column: string, value: string) => ({
              eq: () => ({
                order: async () => {
                  const rows = column === "account_id"
                    ? pricingRulesRows.filter((row) => row.account_id === value)
                    : [...pricingRulesRows];
                  return { data: rows, error: null };
                },
              }),
            }),
          }),
          upsert: async (rows: Array<{ user_id: string; account_id: string; service_type: string }>) => {
            rows.forEach((row) => {
              const exists = pricingRulesRows.some(
                (existing) => existing.user_id === row.user_id && existing.service_type === row.service_type,
              );
              if (!exists) {
                pricingRulesRows.push(row);
              }
            });
            return { error: null };
          },
        };
      }

      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      };
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/logo.png" } }),
      }),
    },
  },
}));

describe("OnboardingProfile page", () => {
  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <OnboardingProfile />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    navigateMock.mockReset();
    refreshProfileMock.mockReset();
    startStripeOnboardingMock.mockReset();
    mockCrewProfiles.length = 0;
    mockedDefaultTaxRate = 8;
    mockedDefaultProfitMargin = 0;
    mockedDefaultSurcharge = 0;
    pricingRulesRows = [];
    window.localStorage.removeItem(ONBOARDING_PROFILE_STORAGE_KEY);
  });

  it("shows profile setup as a multi-slide step", () => {
    renderPage();

    expect(screen.getByText(/^Step 2 of 3$/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload your company logo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Add your services/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByLabelText(/Add your services/i)).toBeInTheDocument();
  });

  it("adds and saves onboarding services", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.change(screen.getByLabelText(/Add your services/i), { target: { value: "Window Cleaning" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/i }));

    expect(screen.getByText("Window Cleaning")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await waitFor(() => {
      expect(pricingRulesRows).toEqual([
        { user_id: "user_1", account_id: "acct_1", service_type: "Window Cleaning" },
      ]);
    });
  });

  it("renders saved slug service types as display labels", async () => {
    pricingRulesRows = [
      { user_id: "user_1", account_id: "acct_1", service_type: "retaining_walls" },
    ];

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText("Retaining Walls")).toBeInTheDocument();
    });
  });

  it("adds a mock crew member", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Add member$/i }));
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: "Jordan Crew" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    await waitFor(() => {
      expect(screen.getByText("Jordan Crew")).toBeInTheDocument();
    });
  });

  it("completes profile onboarding and continues to import", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByDisplayValue("ABC123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByLabelText(/Default Tax Rate/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Default Tax Rate/i), { target: { value: "9.25" } });
    fireEvent.change(screen.getByLabelText(/Default Profit Margin/i), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText(/Default Surcharge/i), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem(ONBOARDING_PROFILE_STORAGE_KEY)).toBe("completed");
      expect(mockedDefaultTaxRate).toBe(9.25);
      expect(mockedDefaultProfitMargin).toBe(18);
      expect(mockedDefaultSurcharge).toBe(2.5);
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/import");
    });
  });

  it("shows connect stripe section on the final slide and triggers stripe onboarding", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    const connectButton = screen.getByRole("button", { name: /^Connect Stripe$/i });
    expect(connectButton).toBeInTheDocument();

    fireEvent.click(connectButton);
    expect(startStripeOnboardingMock).toHaveBeenCalledTimes(1);
  });
});
