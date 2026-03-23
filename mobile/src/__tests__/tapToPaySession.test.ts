import { describe, expect, it, vi } from "vitest";

import type { StripeTerminalAdapter } from "../hooks/useStripeTerminal";
import {
  cancelTapToPaySession,
  mapTerminalState,
  startTapToPaySession,
  type TapToPaySessionApi,
  type TapToPaySessionState,
} from "../hooks/useTapToPaySession";
import type { ParsedTapToPayLink } from "../types/tapToPay";

function createHandoff(overrides: Partial<ParsedTapToPayLink> = {}): ParsedTapToPayLink {
  return {
    route: "tap-to-pay",
    rawUrl:
      "leadsig://tap-to-pay?invoiceId=inv_1&customerId=cus_1&amount=249.5&sessionId=sess_1",
    invoiceId: "inv_1",
    customerId: "cus_1",
    amount: 249.5,
    sessionId: "sess_1",
    ...overrides,
  };
}

function createTerminalAdapter(
  overrides: Partial<StripeTerminalAdapter> = {},
): StripeTerminalAdapter {
  return {
    runtimeStatus: "available",
    dependencyMessage: undefined,
    initialize: vi.fn(async () => ({ readerLabel: "Back Counter iPhone" })),
    collectPaymentMethod: vi.fn(async () => ({ paymentIntentId: "pi_from_collect" })),
    processPayment: vi.fn(async () => ({ paymentIntentId: "pi_from_process" })),
    cancelCurrentOperation: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createSessionApi(overrides: Partial<TapToPaySessionApi> = {}): TapToPaySessionApi {
  return {
    createPaymentSession: vi.fn(async () => ({
      clientSecret: "pi_1_secret_abc",
      paymentIntentId: "pi_1",
      paymentId: "pay_1",
      channel: "terminal" as const,
      paymentMethod: "tap-to-pay" as const,
      status: "terminal_pending" as const,
    })),
    capturePayment: vi.fn(async () => ({
      terminalStatus: "completed" as const,
    })),
    cancelPayment: vi.fn(async () => ({
      terminalStatus: "canceled" as const,
    })),
    ...overrides,
  };
}

describe("mapTerminalState", () => {
  it("maps sdk processing state to terminal_processing", () => {
    expect(mapTerminalState("processing")).toBe("terminal_processing");
  });
});

describe("startTapToPaySession", () => {
  it("runs the tap to pay flow and captures the processed payment", async () => {
    const callOrder: string[] = [];
    const terminal = createTerminalAdapter({
      initialize: vi.fn(async () => {
        callOrder.push("initialize");
        return { readerLabel: "Back Counter iPhone" };
      }),
      collectPaymentMethod: vi.fn(async () => {
        callOrder.push("collect");
        return { paymentIntentId: "pi_1" };
      }),
      processPayment: vi.fn(async () => {
        callOrder.push("process");
        return { paymentIntentId: "pi_1" };
      }),
    });
    const api = createSessionApi({
      createPaymentSession: vi.fn(async () => {
        callOrder.push("create");
        return {
          clientSecret: "pi_1_secret_abc",
          paymentIntentId: "pi_1",
          paymentId: "pay_1",
          channel: "terminal" as const,
          paymentMethod: "tap-to-pay" as const,
          status: "terminal_pending" as const,
        };
      }),
      capturePayment: vi.fn(async () => {
        callOrder.push("capture");
        return {
          terminalStatus: "completed" as const,
        };
      }),
    });
    const emittedPhases: TapToPaySessionState["phase"][] = [];

    const finalState = await startTapToPaySession({
      handoff: createHandoff(),
      terminal,
      api,
      onStateChange: (state) => {
        emittedPhases.push(state.phase);
      },
    });

    expect(callOrder).toEqual(["initialize", "create", "collect", "process", "capture"]);
    expect(emittedPhases).toEqual([
      "initializing_terminal",
      "creating_payment_session",
      "collecting_payment_method",
      "processing_payment",
      "capturing_payment",
      "succeeded",
    ]);
    expect(finalState).toMatchObject({
      phase: "succeeded",
      terminalStatus: "completed",
      invoiceId: "inv_1",
      paymentIntentId: "pi_1",
      paymentId: "pay_1",
      readerLabel: "Back Counter iPhone",
    });
  });

  it("surfaces a missing stripe terminal runtime without calling the backend", async () => {
    const terminal = createTerminalAdapter({
      runtimeStatus: "missing_runtime",
      dependencyMessage:
        "Stripe Terminal React Native SDK is not available. Install the native package or inject a runtime.",
    });
    const api = createSessionApi();

    const finalState = await startTapToPaySession({
      handoff: createHandoff(),
      terminal,
      api,
    });

    expect(api.createPaymentSession).not.toHaveBeenCalled();
    expect(finalState).toMatchObject({
      phase: "sdk_unavailable",
      terminalStatus: null,
    });
    expect(finalState.errorMessage).toContain("Stripe Terminal React Native SDK is not available");
  });

  it("best-effort cancels the terminal when the session fails after initialization", async () => {
    const terminal = createTerminalAdapter({
      initialize: vi.fn(async () => ({ readerLabel: "Back Counter iPhone" })),
    });
    const api = createSessionApi({
      createPaymentSession: vi.fn(async () => {
        throw new Error("create failed");
      }),
    });

    const finalState = await startTapToPaySession({
      handoff: createHandoff(),
      terminal,
      api,
    });

    expect(terminal.cancelCurrentOperation).toHaveBeenCalledTimes(1);
    expect(finalState).toMatchObject({
      phase: "failed",
      terminalStatus: "failed",
    });
    expect(finalState.errorMessage).toContain("create failed");
  });
});

describe("cancelTapToPaySession", () => {
  it("cancels the active session and reconciles the payment intent", async () => {
    const terminal = createTerminalAdapter();
    const api = createSessionApi();
    const currentState: TapToPaySessionState = {
      phase: "processing_payment",
      deviceReady: true,
      handoff: createHandoff(),
      runtimeStatus: "available",
      terminalStatus: "terminal_processing",
      invoiceId: "inv_1",
      customerId: "cus_1",
      amount: 249.5,
      paymentIntentId: "pi_1",
      paymentId: "pay_1",
      sessionId: "sess_1",
      clientSecret: "pi_1_secret_abc",
      readerLabel: "Back Counter iPhone",
      errorMessage: undefined,
    };

    const finalState = await cancelTapToPaySession({
      currentState,
      terminal,
      api,
    });

    expect(terminal.cancelCurrentOperation).toHaveBeenCalledTimes(1);
    expect(api.cancelPayment).toHaveBeenCalledWith({
      paymentId: "pay_1",
      paymentIntentId: "pi_1",
      reason: "user_canceled",
      sessionId: "sess_1",
    });
    expect(finalState).toMatchObject({
      phase: "canceled",
      terminalStatus: "canceled",
    });
  });

  it("tolerates the expected missing-runtime cancel error and still reconciles", async () => {
    const terminal = createTerminalAdapter({
      cancelCurrentOperation: vi.fn(async () => {
        throw new Error(
          "Stripe Terminal React Native SDK is not available. Install the native package or inject a runtime.",
        );
      }),
    });
    const api = createSessionApi();
    const currentState: TapToPaySessionState = {
      phase: "processing_payment",
      deviceReady: true,
      handoff: createHandoff(),
      runtimeStatus: "missing_runtime",
      terminalStatus: "terminal_processing",
      invoiceId: "inv_1",
      customerId: "cus_1",
      amount: 249.5,
      paymentIntentId: "pi_1",
      paymentId: "pay_1",
      sessionId: "sess_1",
      clientSecret: "pi_1_secret_abc",
      readerLabel: "Back Counter iPhone",
      errorMessage: undefined,
    };

    const finalState = await cancelTapToPaySession({
      currentState,
      terminal,
      api,
    });

    expect(api.cancelPayment).toHaveBeenCalledTimes(1);
    expect(finalState).toMatchObject({
      phase: "canceled",
      terminalStatus: "canceled",
    });
  });

  it("surfaces real terminal cancel failures instead of swallowing them", async () => {
    const terminal = createTerminalAdapter({
      cancelCurrentOperation: vi.fn(async () => {
        throw new Error("native cancel crashed");
      }),
    });
    const api = createSessionApi();
    const currentState: TapToPaySessionState = {
      phase: "processing_payment",
      deviceReady: true,
      handoff: createHandoff(),
      runtimeStatus: "available",
      terminalStatus: "terminal_processing",
      invoiceId: "inv_1",
      customerId: "cus_1",
      amount: 249.5,
      paymentIntentId: "pi_1",
      paymentId: "pay_1",
      sessionId: "sess_1",
      clientSecret: "pi_1_secret_abc",
      readerLabel: "Back Counter iPhone",
      errorMessage: undefined,
    };

    const finalState = await cancelTapToPaySession({
      currentState,
      terminal,
      api,
    });

    expect(api.cancelPayment).not.toHaveBeenCalled();
    expect(finalState).toMatchObject({
      phase: "failed",
      terminalStatus: "failed",
    });
    expect(finalState.errorMessage).toContain("native cancel crashed");
  });
});
