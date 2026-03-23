import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ChargePayment from "@/pages/ChargePayment";

const { createPaymentSession, createTapToPayPaymentSession, startOnboarding } = vi.hoisted(() => ({
  createPaymentSession: vi.fn(),
  createTapToPayPaymentSession: vi.fn(),
  startOnboarding: vi.fn(),
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

describe("ChargePayment tap to pay availability", () => {
  it("disables tap to pay across customer and payment method entry points", () => {
    render(
      <MemoryRouter>
        <ChargePayment />
      </MemoryRouter>,
    );

    const customerTapToPayButtons = screen.getAllByRole("button", { name: /Tap to Pay Coming Soon/i });
    expect(customerTapToPayButtons.length).toBeGreaterThan(0);
    customerTapToPayButtons.forEach((button) => expect(button).toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /Martinez Backyard/i }));

    const methodButton = screen.getByRole("button", { name: /Tap to Pay Contactless payment Coming soon/i });
    expect(methodButton).toBeDisabled();
    expect(screen.getByText(/^Coming soon$/i)).toBeInTheDocument();
    expect(createTapToPayPaymentSession).not.toHaveBeenCalled();
  });
});
