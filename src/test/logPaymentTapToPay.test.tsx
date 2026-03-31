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
  it("shows tap to pay as coming soon in the shared log payment modal", () => {
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

    const tapToPayButton = screen.getByRole("button", { name: /Tap to Pay/i });
    expect(tapToPayButton).toBeDisabled();
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();

    fireEvent.click(tapToPayButton);

    expect(onOpenTapToPay).not.toHaveBeenCalled();
  });

  it("shows tap to pay as coming soon on the charge page", () => {
    render(
      <MemoryRouter>
        <ChargePayment />
      </MemoryRouter>,
    );

    expect(
      screen.getAllByRole("button", { name: /Tap to Pay Coming Soon/i }).length,
    ).toBeGreaterThan(0);
  });
});
