import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentCard } from "@/components/payments/PaymentCard";
import PaymentDetail from "@/pages/PaymentDetail";
import { getPaymentMethodLabel } from "@/lib/paymentPresentation";
import type { Payment } from "@/types/payments";

const mockUsePayment = vi.fn();

vi.mock("@/hooks/usePayments", () => ({
  usePayment: (...args: unknown[]) => mockUsePayment(...args),
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <nav aria-label="mobile navigation" />,
}));

describe("tap to pay payment UI", () => {
  const tapToPayPayment: Payment = {
    id: "pay_123",
    invoiceId: "inv_123",
    customerId: "cust_123",
    customerName: "Martinez Backyard",
    jobId: "job_123",
    amount: 249.5,
    method: "tap-to-pay",
    status: "pending",
    paymentChannel: "terminal",
    terminalStatus: "processing",
    stripeTerminalReaderId: "tmr_123",
    stripeTerminalLocationId: "tml_123",
    stripeTerminalPaymentIntentId: "pi_123",
    createdAt: "Mar 23",
  };

  beforeEach(() => {
    mockUsePayment.mockReset();
  });

  it("shows tap to pay and terminal processing state in the payment card", () => {
    render(<PaymentCard payment={tapToPayPayment} />);

    expect(screen.getByText("Tap to Pay")).toBeInTheDocument();
    expect(screen.getByText("Terminal Processing")).toBeInTheDocument();
  });

  it("normalizes both tap to pay method spellings", () => {
    expect(getPaymentMethodLabel("tap-to-pay")).toBe("Tap to Pay");
    expect(getPaymentMethodLabel("tap_to_pay")).toBe("Tap to Pay");
  });

  it("shows terminal troubleshooting metadata on the payment detail page", () => {
    mockUsePayment.mockReturnValue({
      data: {
        id: "pay_123",
        amount: 249.5,
        method: "tap-to-pay",
        status: "pending",
        payment_channel: "terminal",
        stripe_terminal_payment_intent_status: "processing",
        stripe_terminal_reader_id: "tmr_123",
        stripe_terminal_location_id: "tml_123",
        stripe_payment_intent_id: "pi_123",
        transaction_ref: "txn_123",
        receipt_url: null,
        notes: "Collected at the job site.",
        created_at: "2026-03-23T14:00:00.000Z",
        customer: {
          id: "cust_123",
          name: "Martinez Backyard",
          email: null,
          phone: null,
          address: null,
        },
        job: {
          id: "job_123",
          name: "Walkway Installation",
        },
        invoice: {
          id: "inv_123",
          total: 249.5,
          balance_due: 0,
        },
      },
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/payments/pay_123"]}>
        <Routes>
          <Route path="/payments/:id" element={<PaymentDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Tap to Pay")).toBeInTheDocument();
    expect(screen.getAllByText("Terminal Processing")).toHaveLength(2);
    expect(screen.getByText("Reader ID")).toBeInTheDocument();
    expect(screen.getByText("tmr_123")).toBeInTheDocument();
    expect(screen.getByText("Location ID")).toBeInTheDocument();
    expect(screen.getByText("tml_123")).toBeInTheDocument();
    expect(screen.getByText("Collected at the job site.")).toBeInTheDocument();
  });
});
