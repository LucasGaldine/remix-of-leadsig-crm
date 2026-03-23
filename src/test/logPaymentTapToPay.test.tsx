import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { OtherPaymentOptionsModal } from "@/components/payments/OtherPaymentOptionsModal";
import ChargePayment from "@/pages/ChargePayment";

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
    startOnboarding: vi.fn(),
    disconnect: vi.fn(),
    openDashboard: vi.fn(),
    createPaymentSession: vi.fn(),
    createTapToPayPaymentSession: vi.fn(),
    isReady: true,
  }),
}));

describe("log payment tap to pay entry", () => {
  it("shows tap to pay in the shared log payment modal and routes it through the handoff callback", () => {
    const onOpenTapToPay = vi.fn();

    render(
      <OtherPaymentOptionsModal
        open
        onOpenChange={vi.fn()}
        totalAmount={249.5}
        onRecordPayment={vi.fn()}
        onOpenTapToPay={onOpenTapToPay}
        recordingPayment={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Tap to Pay/i }));

    expect(onOpenTapToPay).toHaveBeenCalledWith(249.5);
  });

  it("prefills tap to pay when opened from an invoice detail redirect", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/payments/charge",
            state: {
              invoice: {
                id: "inv_live",
                customerId: "cust_live",
                customerName: "Live Customer",
                balanceDue: 249.5,
                jobName: "Walkway Repair",
                email: "live@example.com",
              },
              selectedMethod: "tap-to-pay",
            },
          },
        ]}
      >
        <ChargePayment />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Live Customer • Tap to Pay/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("249.5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate mobile handoff/i })).toBeInTheDocument();
  });
});
