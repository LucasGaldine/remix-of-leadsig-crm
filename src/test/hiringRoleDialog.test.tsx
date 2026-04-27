import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Hiring from "@/pages/Hiring";

const { updateWebsiteAsyncMock, mockWebsiteConfig } = vi.hoisted(() => ({
  updateWebsiteAsyncMock: vi.fn(),
  mockWebsiteConfig: {
    hiring_roles: [
      {
        id: "role_1",
        title: "Test Role",
        location: "Tampa, FL",
        employment_type: "Full-time",
        description: "",
        acceptable_hourly_pay_min: 18,
        acceptable_hourly_pay_max: 35,
        auto_reject: {
          transportation_enabled: true,
          availability_enabled: true,
          pay_expectation_enabled: true,
        },
      },
    ],
  },
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/settings/StickyActionBar", () => ({
  StickyActionBar: ({ onSave, label }: { onSave: () => void; label?: string }) => (
    <button onClick={onSave}>{label ?? "Save Changes"}</button>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: {
      id: "acct_1",
    },
  }),
}));

vi.mock("@/hooks/useWebsiteSettings", () => ({
  useWebsiteSettings: () => ({
    websiteConfig: mockWebsiteConfig,
    isLoading: false,
    updateWebsiteAsync: updateWebsiteAsyncMock,
    isSaving: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

describe("Hiring role dialog", () => {
  beforeEach(() => {
    updateWebsiteAsyncMock.mockReset();
    updateWebsiteAsyncMock.mockResolvedValue({});
  });

  it("shows edit copy when opening an existing role", async () => {
    render(
      <MemoryRouter>
        <Hiring />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^test role$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /edit role/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^complete$/i })).not.toBeInTheDocument();
  });

  it("shows add copy and a bottom Complete action when creating a role", async () => {
    render(
      <MemoryRouter>
        <Hiring />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add role/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /add role/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^complete$/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /add role/i })).not.toBeInTheDocument();
  });

  it("sends newly added roles with draft status when completing add flow", async () => {
    render(
      <MemoryRouter>
        <Hiring />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add role/i }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/job title/i), {
      target: { value: "Crew Helper" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^complete$/i }));

    await waitFor(() => {
      expect(updateWebsiteAsyncMock).toHaveBeenCalled();
    });

    const payload = updateWebsiteAsyncMock.mock.calls[0]?.[0] as {
      hiring_roles: Array<{ title: string; status?: string }>;
    };
    const newRole = payload.hiring_roles.find((role) => role.title === "Crew Helper");

    expect(newRole).toBeDefined();
    expect(newRole?.status).toBe("draft");
  });

  it("does not persist interview scheduling settings when saving hiring roles", async () => {
    render(
      <MemoryRouter>
        <Hiring />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add role/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/job title/i), {
      target: { value: "Crew Lead" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^complete$/i }));

    await waitFor(() => {
      expect(updateWebsiteAsyncMock).toHaveBeenCalled();
    });

    const payload = updateWebsiteAsyncMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("hiring_interview_availability");
    expect(payload).not.toHaveProperty("hiring_interview_rules");
  });
});
