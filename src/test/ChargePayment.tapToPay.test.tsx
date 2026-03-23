import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChargePayment from "@/pages/ChargePayment";

const {
  createPaymentSession,
  createTapToPayPaymentSession,
  startOnboarding,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  createPaymentSession: vi.fn(),
  createTapToPayPaymentSession: vi.fn(),
  startOnboarding: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

vi.mock("@/hooks/useStripeConnect", () => ({
  useStripeConnect: () => ({
    status: {
      connected: true,
      status: "active",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    },
    loading: false,
    connecting: false,
    checkStatus: vi.fn(),
    startOnboarding,
    disconnect: vi.fn(),
    openDashboard: vi.fn(),
    createPaymentSession,
    createTapToPayPaymentSession,
    isReady: true,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

describe("ChargePayment tap to pay handoff", () => {
  beforeEach(() => {
    createPaymentSession.mockReset();
    createTapToPayPaymentSession.mockReset();
    startOnboarding.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();

    createTapToPayPaymentSession.mockResolvedValue({
      clientSecret: "pi_123_secret_abc",
      paymentIntentId: "pi_123",
      paymentId: "pay_123",
      channel: "terminal",
      paymentMethod: "tap-to-pay",
      status: "terminal_pending",
    });
  });

  it("creates a mobile handoff instead of opening hosted checkout", async () => {
    render(
      <MemoryRouter>
        <ChargePayment />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Martinez Backyard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tap to Pay Contactless payment/i }));

    expect(
      screen.getByText(/Tap to Pay must continue in the mobile app/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This desktop browser can only prepare the handoff/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Generate mobile handoff/i }));

    await waitFor(() => {
      expect(createTapToPayPaymentSession).toHaveBeenCalledWith({
        amount: 4536,
        invoiceId: "inv-1",
        customerId: "cust-1",
        customerEmail: "martinez@example.com",
        customerName: "Martinez Backyard",
        description: "Payment for Walkway Installation",
      });
    });

    expect(createPaymentSession).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Open in mobile app/i })).toHaveAttribute(
      "href",
      expect.stringContaining("leadsig://tap-to-pay"),
    );
  });

  it("clears the generated handoff when the amount changes", async () => {
    render(
      <MemoryRouter>
        <ChargePayment />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Martinez Backyard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tap to Pay Contactless payment/i }));
    fireEvent.click(screen.getByRole("button", { name: /Generate mobile handoff/i }));

    await screen.findByRole("link", { name: /Open in mobile app/i });

    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "4000" } });

    expect(screen.queryByRole("link", { name: /Open in mobile app/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate mobile handoff/i })).toBeInTheDocument();
  });

  it("keeps tap to pay disabled for invalid numeric amounts", async () => {
    render(
      <MemoryRouter>
        <ChargePayment />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Martinez Backyard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tap to Pay Contactless payment/i }));
    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: "." } });

    const handoffButton = screen.getByRole("button", { name: /Generate mobile handoff/i });
    expect(handoffButton).toBeDisabled();

    fireEvent.click(handoffButton);

    await waitFor(() => {
      expect(createTapToPayPaymentSession).not.toHaveBeenCalled();
    });
  });
});
