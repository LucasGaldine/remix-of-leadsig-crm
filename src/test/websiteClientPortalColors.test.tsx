import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Website from "@/pages/Website";

const {
  updateWebsiteAsyncMock,
  refreshProfileMock,
  accountsSingleMock,
  accountsUpdateMock,
  accountsUpdateEqMock,
} = vi.hoisted(() => ({
  updateWebsiteAsyncMock: vi.fn(),
  refreshProfileMock: vi.fn(),
  accountsSingleMock: vi.fn(),
  accountsUpdateMock: vi.fn(),
  accountsUpdateEqMock: vi.fn(),
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/settings/StickyActionBar", () => ({
  StickyActionBar: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      totalLeads: 0,
      leadsLast30Days: 0,
      approvedLeads: 0,
      conversionRate: 0,
      weeklyCounts: [],
    },
    isLoading: false,
  }),
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/website/LandingPageView", () => ({
  LandingPageView: () => <div data-testid="landing-page-preview" />,
}));

vi.mock("@/hooks/useWebsiteSettings", () => ({
  useWebsiteSettings: () => ({
    websiteConfig: {
      published: true,
      hero: {
        headline: "Hello",
        subheadline: "World",
        cta_text: "Get quote",
      },
      about: {
        text: "About",
      },
      services: [],
    },
    isLoading: false,
    updateWebsiteAsync: updateWebsiteAsyncMock,
    isSaving: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: {
      id: "acct_1",
      company_name: "LeadSig",
      company_phone: "555-1234",
      company_email: "hello@example.com",
      company_address: "1 Main St",
      logo_url: null,
      settings: {
        client_portal_color: "#334155",
        client_portal_text_color: "#ffffff",
        client_portal_highlight_color: "#f59e0b",
        existing_setting: true,
      },
    },
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "pricing_rules") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              single: accountsSingleMock,
            }),
          }),
          update: accountsUpdateMock,
        };
      }

      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    },
  },
}));

describe("Website client portal colors", () => {
  beforeEach(() => {
    updateWebsiteAsyncMock.mockReset();
    refreshProfileMock.mockReset();
    accountsSingleMock.mockReset();
    accountsUpdateMock.mockReset();
    accountsUpdateEqMock.mockReset();

    updateWebsiteAsyncMock.mockResolvedValue({});
    accountsSingleMock.mockResolvedValue({
      data: {
        settings: {
          website: {
            published: true,
          },
          existing_setting: true,
        },
      },
      error: null,
    });
    accountsUpdateEqMock.mockResolvedValue({ error: null });
    accountsUpdateMock.mockReturnValue({
      eq: accountsUpdateEqMock,
    });
  });

  it("saves client portal colors from the Website page", async () => {
    render(
      <MemoryRouter>
        <Website />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/brand color hex/i), {
      target: { value: "#123456" },
    });
    fireEvent.change(screen.getByLabelText(/brand text color hex/i), {
      target: { value: "#f0f0f0" },
    });
    fireEvent.change(screen.getByLabelText(/highlight color hex/i), {
      target: { value: "#ff9900" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateWebsiteAsyncMock).toHaveBeenCalled();
      expect(accountsUpdateMock).toHaveBeenCalled();
    });

    const payload = accountsUpdateMock.mock.calls[0]?.[0] as {
      settings: Record<string, unknown>;
    };

    expect(payload.settings.client_portal_color).toBe("#123456");
    expect(payload.settings.client_portal_text_color).toBe("#f0f0f0");
    expect(payload.settings.client_portal_highlight_color).toBe("#ff9900");
    expect(payload.settings.existing_setting).toBe(true);
    expect(refreshProfileMock).toHaveBeenCalledTimes(1);
  });

  it("saves custom domain DNS settings from the Website page", async () => {
    render(
      <MemoryRouter>
        <Website />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/custom domain/i), {
      target: { value: "https://www.acme.com/" },
    });
    fireEvent.blur(screen.getByLabelText(/custom domain/i));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateWebsiteAsyncMock).toHaveBeenCalled();
    });

    const payload = updateWebsiteAsyncMock.mock.calls[0]?.[0] as {
      custom_domain?: string;
    };

    expect(payload.custom_domain).toBe("www.acme.com");
  });
});
