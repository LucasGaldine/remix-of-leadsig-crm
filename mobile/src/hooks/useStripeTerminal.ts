import { useMemo } from "react";

export type StripeTerminalRuntimeStatus = "available" | "missing_runtime";

export type StripeTerminalSdkState =
  | "initializing"
  | "ready"
  | "collecting_payment_method"
  | "processing"
  | "succeeded"
  | "canceled"
  | "failed";

export interface StripeTerminalInitializeResult {
  readerLabel?: string;
}

export interface StripeTerminalPaymentResult {
  paymentIntentId?: string;
}

export interface StripeTerminalRuntime {
  initialize(): Promise<StripeTerminalInitializeResult>;
  collectPaymentMethod(input: { clientSecret: string }): Promise<StripeTerminalPaymentResult>;
  processPayment(): Promise<StripeTerminalPaymentResult>;
  cancelCurrentOperation(): Promise<void>;
}

export interface StripeTerminalAdapter {
  runtimeStatus: StripeTerminalRuntimeStatus;
  dependencyMessage?: string;
  initialize(): Promise<StripeTerminalInitializeResult>;
  collectPaymentMethod(input: { clientSecret: string }): Promise<StripeTerminalPaymentResult>;
  processPayment(): Promise<StripeTerminalPaymentResult>;
  cancelCurrentOperation(): Promise<void>;
}

declare global {
  var __LEADSIG_STRIPE_TERMINAL_RUNTIME__: StripeTerminalRuntime | undefined;
}

export const STRIPE_TERMINAL_MISSING_RUNTIME_MESSAGE =
  "Stripe Terminal React Native SDK is not available. Install the native package or inject a runtime.";

function createUnavailableStripeTerminalError(message = STRIPE_TERMINAL_MISSING_RUNTIME_MESSAGE): Error {
  return new Error(message);
}

function resolveStripeTerminalRuntime(): StripeTerminalRuntime | null {
  return globalThis.__LEADSIG_STRIPE_TERMINAL_RUNTIME__ ?? null;
}

export function createStripeTerminalAdapter(
  runtime: StripeTerminalRuntime | null | undefined = resolveStripeTerminalRuntime(),
): StripeTerminalAdapter {
  if (!runtime) {
    return {
      runtimeStatus: "missing_runtime",
      dependencyMessage: STRIPE_TERMINAL_MISSING_RUNTIME_MESSAGE,
      async initialize() {
        throw createUnavailableStripeTerminalError();
      },
      async collectPaymentMethod() {
        throw createUnavailableStripeTerminalError();
      },
      async processPayment() {
        throw createUnavailableStripeTerminalError();
      },
      async cancelCurrentOperation() {
        throw createUnavailableStripeTerminalError();
      },
    };
  }

  return {
    runtimeStatus: "available",
    initialize: () => runtime.initialize(),
    collectPaymentMethod: (input) => runtime.collectPaymentMethod(input),
    processPayment: () => runtime.processPayment(),
    cancelCurrentOperation: () => runtime.cancelCurrentOperation(),
  };
}

interface UseStripeTerminalOptions {
  runtime?: StripeTerminalRuntime | null;
}

export function useStripeTerminal(options: UseStripeTerminalOptions = {}) {
  const adapter = useMemo(
    () => createStripeTerminalAdapter(options.runtime),
    [options.runtime],
  );

  return {
    adapter,
    available: adapter.runtimeStatus === "available",
    dependencyMessage: adapter.dependencyMessage,
  };
}
