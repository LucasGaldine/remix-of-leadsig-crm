import { describe, expect, expectTypeOf, it } from "vitest";

import {
  buildTapToPayPayload,
  buildTapToPayHandoffPayload,
  createTapToPayDeepLink,
  isDirectTapToPayHandoffSupported,
  type TapToPayPaymentSessionRequest,
  type TapToPayPaymentSessionResponse,
} from "@/lib/tapToPay";
import {
  tapToPayPaymentMethods,
  tapToPayStatuses,
  type Payment,
  type PaymentChannel,
  type TapToPayTerminalStatus,
} from "@/types/payments";

describe("tap to pay payment contract", () => {
  it("exports the tap to pay payment method list", () => {
    expect(tapToPayPaymentMethods).toEqual(["tap-to-pay"]);
  });

  it("exports the terminal lifecycle list", () => {
    expect(tapToPayStatuses).toEqual([
      "terminal_pending",
      "terminal_processing",
      "completed",
      "failed",
      "canceled",
    ]);
  });

  it("keeps the terminal types aligned with the shared payment contract", () => {
    expectTypeOf<PaymentChannel>().toEqualTypeOf<"online" | "terminal">();
    expectTypeOf<TapToPayTerminalStatus>().toEqualTypeOf<
      "terminal_pending" | "terminal_processing" | "completed" | "failed" | "canceled"
    >();
    expectTypeOf<Payment>().toMatchTypeOf<{
      paymentChannel?: PaymentChannel;
      terminalStatus?: TapToPayTerminalStatus;
      stripeTerminalReaderId?: string;
      stripeTerminalLocationId?: string;
      stripeTerminalPaymentIntentId?: string;
    }>();
  });
});

describe("buildTapToPayPayload", () => {
  it("marks the payment request as a terminal tap to pay session", () => {
    expect(
      buildTapToPayPayload({
        amount: 125,
        invoiceId: "inv_123",
        customerId: "cust_123",
      }),
    ).toEqual({
      amount: 125,
      invoiceId: "inv_123",
      customerId: "cust_123",
      channel: "terminal",
      paymentMethod: "tap-to-pay",
    });
  });

  it("preserves optional metadata for the terminal payment intent request", () => {
    expect(
      buildTapToPayPayload({
        amount: 249.5,
        invoiceId: "inv_456",
        customerId: "cust_456",
        jobId: "job_456",
        customerEmail: "customer@example.com",
        customerName: "Customer Example",
        description: "Kitchen deposit",
      }),
    ).toMatchObject({
      jobId: "job_456",
      customerEmail: "customer@example.com",
      customerName: "Customer Example",
      description: "Kitchen deposit",
    });
  });

  it("exports request and response types used by the hook", () => {
    expectTypeOf<TapToPayPaymentSessionRequest>().toMatchTypeOf<{
      amount: number;
      invoiceId: string;
      customerId: string;
      channel: "terminal";
      paymentMethod: "tap-to-pay";
    }>();
    expectTypeOf<TapToPayPaymentSessionResponse>().toMatchTypeOf<{
      clientSecret: string | null;
      paymentIntentId: string;
      paymentId: string | null;
      channel: "terminal";
      paymentMethod: "tap-to-pay";
      status: "terminal_pending";
    }>();
  });
});

describe("tap to pay handoff helpers", () => {
  it("supports the minimal deep-link contract from the web handoff plan", () => {
    expect(createTapToPayDeepLink({ invoiceId: "inv_1" })).toBe("leadsig://tap-to-pay?invoiceId=inv_1");
  });

  it("fills the browser handoff with the payment session identifiers", () => {
    expect(
      buildTapToPayHandoffPayload({
        invoiceId: "inv_123",
        customerId: "cust_123",
        amount: 125.5,
        paymentIntentId: "pi_123",
        paymentId: "pay_123",
      }),
    ).toEqual({
      invoiceId: "inv_123",
      customerId: "cust_123",
      amount: 125.5,
      paymentIntentId: "pi_123",
      paymentId: "pay_123",
      sessionId: "pay_123",
    });
  });

  it("creates a leadsig deep link for the mobile app", () => {
    const deepLink = createTapToPayDeepLink({
      invoiceId: "inv_456",
      customerId: "cust_456",
      amount: 249.5,
      paymentIntentId: "pi_456",
      paymentId: "pay_456",
    });

    const parsed = new URL(deepLink);

    expect(parsed.protocol).toBe("leadsig:");
    expect(parsed.host).toBe("tap-to-pay");
    expect(parsed.searchParams.get("invoiceId")).toBe("inv_456");
    expect(parsed.searchParams.get("customerId")).toBe("cust_456");
    expect(parsed.searchParams.get("amount")).toBe("249.5");
    expect(parsed.searchParams.get("paymentIntentId")).toBe("pi_456");
    expect(parsed.searchParams.get("paymentId")).toBe("pay_456");
    expect(parsed.searchParams.get("sessionId")).toBe("pay_456");
  });

  it("marks desktop browsers as handoff-only environments", () => {
    expect(
      isDirectTapToPayHandoffSupported(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("marks supported mobile browsers as direct handoff environments", () => {
    expect(
      isDirectTapToPayHandoffSupported(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });
});
