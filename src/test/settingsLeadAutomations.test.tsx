import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsLeadAutomations from "@/pages/SettingsLeadAutomations";

const { updateSettingsAsyncMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  updateSettingsAsyncMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

let mockSettings: Record<string, unknown> | null;

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/components/settings/UnsavedChangesDialog", () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock("@/hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: () => null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: { id: "acct_1" },
  }),
}));

vi.mock("@/hooks/useAccountSettings", () => ({
  useAccountSettings: () => ({
    settings: mockSettings,
    updateSettingsAsync: updateSettingsAsyncMock,
    isSaving: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("SettingsLeadAutomations", () => {
  beforeEach(() => {
    mockSettings = {};
    updateSettingsAsyncMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    updateSettingsAsyncMock.mockResolvedValue({});
  });

  it("hydrates job message automation fields from account settings", () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_template: "Hi {{job_name}}",
        job_service_types: ["Concrete", "Deck"],
        trigger: {
          type: "before_schedule_start",
          offset_minutes: 90,
        },
        endpoint: {
          url: "https://example.com/webhook",
          auth_header_name: "Authorization",
          auth_header_value: "Bearer test",
        },
        retry: {
          max_attempts: 4,
          backoff_minutes: 6,
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsLeadAutomations />
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: /enable job message automation/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText(/message template/i)).toHaveValue("Hi {{job_name}}");
    expect(screen.getByRole("checkbox", { name: /concrete/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /deck/i })).toBeChecked();
    expect(screen.getByLabelText(/trigger timing/i)).toHaveValue("before_schedule_start");
    expect(screen.getByLabelText(/offset minutes/i)).toHaveValue(90);
    expect(screen.getByLabelText(/job message endpoint url/i)).toHaveValue("https://example.com/webhook");
    expect(screen.getByLabelText(/job message auth header name/i)).toHaveValue("Authorization");
    expect(screen.getByLabelText(/job message auth header value/i)).toHaveValue("Bearer test");
    expect(screen.getByLabelText(/max retry attempts/i)).toHaveValue(4);
    expect(screen.getByLabelText(/retry backoff minutes/i)).toHaveValue(6);
  });

  it("saves full job message automation payload", async () => {
    render(
      <MemoryRouter>
        <SettingsLeadAutomations />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /enable job message automation/i }));
    fireEvent.change(screen.getByLabelText(/message template/i), { target: { value: "Reminder for {{job_name}}" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /pavers \/ patio/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /landscaping/i }));
    fireEvent.change(screen.getByLabelText(/trigger timing/i), { target: { value: "after_schedule_start" } });
    fireEvent.change(screen.getByLabelText(/offset minutes/i), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/job message endpoint url/i), { target: { value: "https://hooks.example.com/jobs" } });
    fireEvent.change(screen.getByLabelText(/job message auth header name/i), { target: { value: "x-api-key" } });
    fireEvent.change(screen.getByLabelText(/job message auth header value/i), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText(/max retry attempts/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/retry backoff minutes/i), { target: { value: "7" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalledWith({
        job_message_automation: {
          enabled: true,
          message_template: "Reminder for {{job_name}}",
          job_service_types: ["Pavers / Patio", "Landscaping"],
          trigger: {
            type: "after_schedule_start",
            offset_minutes: 30,
          },
          endpoint: {
            url: "https://hooks.example.com/jobs",
            auth_header_name: "x-api-key",
            auth_header_value: "secret",
          },
          retry: {
            max_attempts: 5,
            backoff_minutes: 7,
          },
        },
      });
    });
  });

  it("shows save success toast", async () => {
    render(
      <MemoryRouter>
        <SettingsLeadAutomations />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /enable job message automation/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Lead automation settings saved");
    });
  });
});
