import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StripeTerminalAdapter,
  StripeTerminalRuntime,
  StripeTerminalRuntimeStatus,
  StripeTerminalSdkState,
} from "./useStripeTerminal";
import {
  STRIPE_TERMINAL_MISSING_RUNTIME_MESSAGE,
  useStripeTerminal,
} from "./useStripeTerminal";
import type { ParsedTapToPayLink } from "../types/tapToPay";

export type TapToPayTerminalStatus =
  | "terminal_pending"
  | "terminal_processing"
  | "completed"
  | "failed"
  | "canceled";

export type TapToPaySessionPhase =
  | "awaiting_handoff"
  | "sdk_unavailable"
  | "initializing_terminal"
  | "creating_payment_session"
  | "collecting_payment_method"
  | "processing_payment"
  | "capturing_payment"
  | "succeeded"
  | "canceling"
  | "canceled"
  | "failed"
  | "ready";

export interface TapToPayPaymentSessionResponse {
  clientSecret: string | null;
  paymentIntentId: string;
  paymentId: string | null;
  channel: "terminal";
  paymentMethod: "tap-to-pay";
  status: "terminal_pending";
}

export interface TapToPayCaptureResponse {
  terminalStatus: Extract<TapToPayTerminalStatus, "completed" | "failed" | "canceled" | "terminal_processing">;
}

export interface TapToPayCancelResponse {
  terminalStatus: Extract<TapToPayTerminalStatus, "canceled" | "failed">;
}

export interface TapToPaySessionApi {
  createPaymentSession(input: {
    invoiceId: string;
    customerId: string;
    amount: number;
  }): Promise<TapToPayPaymentSessionResponse>;
  capturePayment(input: {
    paymentIntentId: string;
    paymentId?: string | null;
    sessionId?: string;
  }): Promise<TapToPayCaptureResponse>;
  cancelPayment(input: {
    paymentIntentId?: string;
    paymentId?: string | null;
    sessionId?: string;
    reason?: string;
  }): Promise<TapToPayCancelResponse>;
}

export interface TapToPaySessionState {
  phase: TapToPaySessionPhase;
  deviceReady: boolean;
  handoff: ParsedTapToPayLink | null;
  runtimeStatus: StripeTerminalRuntimeStatus;
  terminalStatus: TapToPayTerminalStatus | null;
  invoiceId?: string;
  customerId?: string;
  amount?: number;
  paymentIntentId?: string;
  paymentId?: string | null;
  sessionId?: string;
  clientSecret?: string | null;
  readerLabel?: string;
  errorMessage?: string;
}

export const TAP_TO_PAY_API_MISSING_MESSAGE =
  "Tap to Pay backend client is not configured for the mobile scaffold.";

function createMissingTapToPayApiError(): Error {
  return new Error(TAP_TO_PAY_API_MISSING_MESSAGE);
}

export function createUnconfiguredTapToPaySessionApi(): TapToPaySessionApi {
  return {
    async createPaymentSession() {
      throw createMissingTapToPayApiError();
    },
    async capturePayment() {
      throw createMissingTapToPayApiError();
    },
    async cancelPayment() {
      throw createMissingTapToPayApiError();
    },
  };
}

export function mapTerminalState(state: StripeTerminalSdkState): TapToPayTerminalStatus {
  switch (state) {
    case "processing":
    case "collecting_payment_method":
      return "terminal_processing";
    case "succeeded":
      return "completed";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "initializing":
    case "ready":
    default:
      return "terminal_pending";
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected Tap to Pay error";
}

function isIgnorableTerminalCancelError(error: unknown): boolean {
  const message = getErrorMessage(error);

  return (
    message.includes(STRIPE_TERMINAL_MISSING_RUNTIME_MESSAGE) ||
    message.toLowerCase().includes("no active operation") ||
    message.toLowerCase().includes("no current operation")
  );
}

async function cleanupTerminalOperation(terminal: StripeTerminalAdapter): Promise<string | null> {
  try {
    await terminal.cancelCurrentOperation();
    return null;
  } catch (error) {
    if (isIgnorableTerminalCancelError(error)) {
      return null;
    }

    return getErrorMessage(error);
  }
}

function appendErrorMessage(primary: string, secondary?: string | null): string {
  if (!secondary) {
    return primary;
  }

  return `${primary} Cleanup failed: ${secondary}`;
}

function hasSessionCreationInputs(handoff: ParsedTapToPayLink | null): handoff is ParsedTapToPayLink & {
  invoiceId: string;
  customerId: string;
  amount: number;
} {
  return Boolean(
    handoff &&
      handoff.invoiceId &&
      handoff.customerId &&
      typeof handoff.amount === "number" &&
      Number.isFinite(handoff.amount),
  );
}

interface TapToPayStateUpdateContext {
  handoff: ParsedTapToPayLink | null;
  runtimeStatus: StripeTerminalRuntimeStatus;
}

function applyStatePatch(
  state: TapToPaySessionState,
  patch: Partial<TapToPaySessionState>,
): TapToPaySessionState {
  return {
    ...state,
    ...patch,
  };
}

export function createInitialTapToPaySessionState(
  context: TapToPayStateUpdateContext,
): TapToPaySessionState {
  const { handoff, runtimeStatus } = context;

  if (!handoff) {
    return {
      phase: "awaiting_handoff",
      deviceReady: runtimeStatus === "available",
      handoff,
      runtimeStatus,
      terminalStatus: null,
      errorMessage: undefined,
    };
  }

  return {
    phase: runtimeStatus === "available" ? "ready" : "sdk_unavailable",
    deviceReady: runtimeStatus === "available",
    handoff,
    runtimeStatus,
    terminalStatus: null,
    invoiceId: handoff.invoiceId,
    customerId: handoff.customerId,
    amount: handoff.amount,
    paymentIntentId: handoff.paymentIntentId,
    sessionId: handoff.sessionId,
    errorMessage: undefined,
  };
}

interface StartTapToPaySessionOptions {
  handoff: ParsedTapToPayLink | null;
  terminal: StripeTerminalAdapter;
  api: TapToPaySessionApi;
  onStateChange?: (state: TapToPaySessionState) => void;
}

export async function startTapToPaySession(
  options: StartTapToPaySessionOptions,
): Promise<TapToPaySessionState> {
  const { handoff, terminal, api, onStateChange } = options;
  let terminalInitialized = false;
  let state = createInitialTapToPaySessionState({
    handoff,
    runtimeStatus: terminal.runtimeStatus,
  });

  const commit = (patch: Partial<TapToPaySessionState>) => {
    state = applyStatePatch(state, patch);
    onStateChange?.(state);
    return state;
  };

  if (!handoff) {
    return commit({
      phase: "awaiting_handoff",
      errorMessage: "Waiting for a Tap to Pay handoff.",
    });
  }

  if (terminal.runtimeStatus !== "available") {
    return commit({
      phase: "sdk_unavailable",
      deviceReady: false,
      errorMessage: terminal.dependencyMessage,
    });
  }

  if (!hasSessionCreationInputs(handoff)) {
    return commit({
      phase: "failed",
      terminalStatus: "failed",
      errorMessage: "Incomplete Tap to Pay handoff. invoiceId, customerId, and amount are required.",
    });
  }

  try {
    commit({
      phase: "initializing_terminal",
      terminalStatus: mapTerminalState("initializing"),
      errorMessage: undefined,
    });

    const initialized = await terminal.initialize();
    terminalInitialized = true;

    commit({
      phase: "creating_payment_session",
      readerLabel: initialized.readerLabel,
      terminalStatus: "terminal_pending",
    });

    const session = await api.createPaymentSession({
      invoiceId: handoff.invoiceId,
      customerId: handoff.customerId,
      amount: handoff.amount,
    });

    if (!session.clientSecret) {
      throw new Error("Tap to Pay session did not return a client secret.");
    }

    commit({
      phase: "collecting_payment_method",
      terminalStatus: mapTerminalState("collecting_payment_method"),
      paymentIntentId: session.paymentIntentId,
      paymentId: session.paymentId,
      clientSecret: session.clientSecret,
    });

    const collectedPayment = await terminal.collectPaymentMethod({
      clientSecret: session.clientSecret,
    });

    commit({
      phase: "processing_payment",
      terminalStatus: mapTerminalState("processing"),
      paymentIntentId: collectedPayment.paymentIntentId ?? session.paymentIntentId,
    });

    const processedPayment = await terminal.processPayment();
    const paymentIntentId = processedPayment.paymentIntentId ?? state.paymentIntentId;

    if (!paymentIntentId) {
      throw new Error("Stripe Terminal did not return a payment intent id.");
    }

    commit({
      phase: "capturing_payment",
      terminalStatus: "terminal_processing",
      paymentIntentId,
    });

    const capturedPayment = await api.capturePayment({
      paymentIntentId,
      paymentId: state.paymentId,
      sessionId: state.sessionId,
    });

    return commit({
      phase: "succeeded",
      terminalStatus: capturedPayment.terminalStatus,
      paymentIntentId,
    });
  } catch (error) {
    const cleanupError = terminalInitialized
      ? await cleanupTerminalOperation(terminal)
      : null;

    return commit({
      phase: "failed",
      terminalStatus: "failed",
      errorMessage: appendErrorMessage(getErrorMessage(error), cleanupError),
    });
  }
}

interface CancelTapToPaySessionOptions {
  currentState: TapToPaySessionState;
  terminal: StripeTerminalAdapter;
  api: TapToPaySessionApi;
  onStateChange?: (state: TapToPaySessionState) => void;
}

export async function cancelTapToPaySession(
  options: CancelTapToPaySessionOptions,
): Promise<TapToPaySessionState> {
  const { currentState, terminal, api, onStateChange } = options;
  let state = currentState;

  const commit = (patch: Partial<TapToPaySessionState>) => {
    state = applyStatePatch(state, patch);
    onStateChange?.(state);
    return state;
  };

  commit({
    phase: "canceling",
    errorMessage: undefined,
  });

  const terminalCancelError = await cleanupTerminalOperation(terminal);

  if (terminalCancelError) {
    return commit({
      phase: "failed",
      terminalStatus: "failed",
      errorMessage: terminalCancelError,
    });
  }

  if (!state.paymentIntentId && !state.paymentId && !state.sessionId) {
    return commit({
      phase: "canceled",
      terminalStatus: "canceled",
    });
  }

  try {
    const canceledPayment = await api.cancelPayment({
      paymentIntentId: state.paymentIntentId,
      paymentId: state.paymentId,
      sessionId: state.sessionId,
      reason: "user_canceled",
    });

    return commit({
      phase: "canceled",
      terminalStatus: canceledPayment.terminalStatus,
    });
  } catch (error) {
    return commit({
      phase: "failed",
      terminalStatus: "failed",
      errorMessage: getErrorMessage(error),
    });
  }
}

interface UseTapToPaySessionOptions {
  handoff: ParsedTapToPayLink | null;
  api?: TapToPaySessionApi;
  runtime?: StripeTerminalRuntime | null;
}

export function useTapToPaySession(options: UseTapToPaySessionOptions) {
  const { adapter, available, dependencyMessage } = useStripeTerminal({
    runtime: options.runtime,
  });
  const api = useMemo(
    () => options.api ?? createUnconfiguredTapToPaySessionApi(),
    [options.api],
  );
  const [state, setState] = useState(() =>
    createInitialTapToPaySessionState({
      handoff: options.handoff,
      runtimeStatus: adapter.runtimeStatus,
    }),
  );

  useEffect(() => {
    setState(
      createInitialTapToPaySessionState({
        handoff: options.handoff,
        runtimeStatus: adapter.runtimeStatus,
      }),
    );
  }, [adapter.runtimeStatus, options.handoff]);

  const start = useCallback(() => {
    return startTapToPaySession({
      handoff: options.handoff,
      terminal: adapter,
      api,
      onStateChange: setState,
    });
  }, [adapter, api, options.handoff]);

  const cancel = useCallback(() => {
    return cancelTapToPaySession({
      currentState: state,
      terminal: adapter,
      api,
      onStateChange: setState,
    });
  }, [adapter, api, state]);

  return {
    state,
    start,
    cancel,
    available,
    dependencyMessage,
  };
}
