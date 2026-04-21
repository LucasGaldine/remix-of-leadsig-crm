import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsAutoResponses from "@/pages/SettingsAutoResponses";

const { updateSettingsAsyncMock, toastErrorMock, toastSuccessMock, invokeFunctionMock } = vi.hoisted(() => ({
  updateSettingsAsyncMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  invokeFunctionMock: vi.fn(),
}));

let mockSettings: Record<string, unknown> | null;
let mockPricingPlan: "free" | "basic" | "premium";

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

vi.mock("@/components/features/PlanGate", () => ({
  PlanGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useAccountSettings", () => ({
  useAccountSettings: () => ({
    settings: mockSettings,
    updateSettingsAsync: updateSettingsAsyncMock,
    isSaving: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentAccount: {
      id: "acct_1",
      pricing_plan: mockPricingPlan,
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeFunctionMock,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("SettingsAutoResponses payment emails", () => {
  beforeEach(() => {
    mockSettings = {};
    mockPricingPlan = "premium";
    updateSettingsAsyncMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    invokeFunctionMock.mockReset();
    updateSettingsAsyncMock.mockResolvedValue({});
    invokeFunctionMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("defaults payment email toggles to enabled", () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: /send payment email when estimate is approved/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send payment email when invoice is sent/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send payment email when payment is logged/i })).toHaveAttribute("aria-checked", "true");
  });

  it("hydrates payment email toggles from account settings", () => {
    mockSettings = {
      job_message_automation: {
        payment_emails: {
          estimate_approved: false,
          invoice_sent: true,
          payment_logged: false,
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByRole("switch", { name: /send payment email when estimate is approved/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /send payment email when invoice is sent/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /send payment email when payment is logged/i })).toHaveAttribute("aria-checked", "false");
  });

  it("saves payment email preferences into job message automation settings", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("switch", { name: /send payment email when estimate is approved/i }));
    fireEvent.click(screen.getByRole("switch", { name: /send payment email when payment is logged/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: {
        payment_emails?: Record<string, boolean>;
      };
    };

    expect(payload.job_message_automation?.payment_emails).toEqual({
      estimate_approved: false,
      invoice_sent: true,
      payment_logged: false,
    });
  });

  it("forces payment email preferences off for free plan accounts", async () => {
    mockPricingPlan = "free";
    mockSettings = {
      job_message_automation: {
        payment_emails: {
          estimate_approved: true,
          invoice_sent: true,
          payment_logged: true,
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: {
        enabled?: boolean;
        payment_emails?: Record<string, boolean>;
      };
    };

    expect(payload.job_message_automation?.enabled).toBe(false);
    expect(payload.job_message_automation?.payment_emails).toEqual({
      estimate_approved: false,
      invoice_sent: false,
      payment_logged: false,
    });
  });

  it("hydrates connected Twilio fields from automation settings", () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Template 1",
            content: "Hello",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
        twilio: {
          account_sid: "AC1234567890abcdef1234567890abcd",
          auth_token: "twilio_auth_token",
          from_number: "+15550001111",
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/twilio account sid/i)).toHaveValue("AC1234567890abcdef1234567890abcd");
    expect(screen.getByLabelText(/twilio auth token/i)).toHaveValue("twilio_auth_token");
    expect(screen.getByLabelText(/connected twilio sender number/i)).toHaveValue("+15550001111");
  });

  it("requires connected twilio credentials for text templates before saving", async () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Template 1",
            content: "Hello",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
        twilio: {
          from_number: "",
        },
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Connect your Twilio account SID, auth token, and sender number to send automated text messages.");
    });
    expect(updateSettingsAsyncMock).not.toHaveBeenCalled();
  });

  it("saves connected twilio credentials into job message automation settings", async () => {
    mockSettings = {
      job_message_automation: {
        enabled: true,
        message_templates: [
          {
            id: "template-1",
            name: "Template 1",
            content: "Hello",
            is_finished: true,
            delivery_channel: "text",
            job_service_types: [],
            trigger: { type: "immediate", offset_value: 0, offset_unit: "days" },
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/twilio account sid/i), { target: { value: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } });
    fireEvent.change(screen.getByLabelText(/twilio auth token/i), { target: { value: "twilio_secret_token" } });
    fireEvent.change(screen.getByLabelText(/connected twilio sender number/i), { target: { value: "+15554443333" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSettingsAsyncMock).toHaveBeenCalled();
    });

    const payload = updateSettingsAsyncMock.mock.calls[0]?.[0] as {
      job_message_automation?: {
        twilio?: { account_sid?: string; auth_token?: string; from_number?: string };
      };
    };

    expect(payload.job_message_automation?.twilio).toEqual({
      account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      auth_token: "twilio_secret_token",
      from_number: "+15554443333",
    });
  });

  it("opens a send-test-message modal and sends to the entered phone number", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /send test message/i }));
    fireEvent.change(screen.getByLabelText(/destination phone number/i), { target: { value: "(555) 222-3344" } });
    fireEvent.click(screen.getByRole("button", { name: /^send message$/i }));

    await waitFor(() => {
      expect(invokeFunctionMock).toHaveBeenCalledWith("send-job-automation-test-message", {
        body: {
          account_id: "acct_1",
          to: "+15552223344",
        },
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Test message sent to +15552223344");
  });

  it("requires a valid destination phone number before sending a test message", async () => {
    render(
      <MemoryRouter>
        <SettingsAutoResponses />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /send test message/i }));
    fireEvent.click(screen.getByRole("button", { name: /^send message$/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Enter a valid phone number to send the test message.");
    });
    expect(invokeFunctionMock).not.toHaveBeenCalled();
  });
});
