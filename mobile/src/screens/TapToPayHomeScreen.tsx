import type { FC } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useTapToPaySession } from "../hooks/useTapToPaySession";
import type { ParsedTapToPayLink } from "../types/tapToPay";

interface TapToPayHomeScreenProps {
  handoff: ParsedTapToPayLink | null;
}

export const TapToPayHomeScreen: FC<TapToPayHomeScreenProps> = ({ handoff }) => {
  const { state, start, cancel, available, dependencyMessage } = useTapToPaySession({
    handoff,
  });
  const hasCancelableSession = Boolean(state.paymentIntentId || state.paymentId || state.sessionId);
  const startDisabled =
    !handoff ||
    state.phase === "initializing_terminal" ||
    state.phase === "creating_payment_session" ||
    state.phase === "collecting_payment_method" ||
    state.phase === "processing_payment" ||
    state.phase === "capturing_payment" ||
    state.phase === "canceling";
  const cancelDisabled =
    !hasCancelableSession ||
    state.phase === "canceled" ||
    state.phase === "succeeded" ||
    state.phase === "failed" ||
    state.phase === "canceling";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>LeadSig Mobile</Text>
        <Text style={styles.title}>Tap to Pay</Text>
        <Text style={styles.subtitle}>
          Session orchestration is wired for Stripe Terminal. The host app still needs a native
          runtime and backend client to execute a real Tap to Pay charge.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Terminal runtime</Text>
          <Text style={styles.value}>{available ? "Runtime available" : "Runtime not attached"}</Text>
          <Text style={styles.value}>Session phase: {formatPhase(state.phase)}</Text>
          <Text style={styles.value}>
            Terminal status: {state.terminalStatus ? formatStatus(state.terminalStatus) : "Idle"}
          </Text>
          <Text style={styles.value}>Reader: {state.readerLabel ?? "Pending initialization"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Incoming session</Text>
          <Text style={styles.value}>Invoice: {state.invoiceId ?? "Waiting for handoff"}</Text>
          <Text style={styles.value}>Customer: {state.customerId ?? "Pending"}</Text>
          <Text style={styles.value}>Amount: {formatAmount(state.amount)}</Text>
          <Text style={styles.value}>Payment intent: {state.paymentIntentId ?? "Pending"}</Text>
          <Text style={styles.value}>Payment record: {state.paymentId ?? "Pending"}</Text>
          <Text style={styles.value}>Session: {state.sessionId ?? "Pending"}</Text>
        </View>

        {dependencyMessage ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Dependency boundary</Text>
            <Text style={styles.noticeText}>{dependencyMessage}</Text>
          </View>
        ) : null}

        {state.errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.noticeTitle}>Session message</Text>
            <Text style={styles.noticeText}>{state.errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={startDisabled}
            onPress={() => {
              void start();
            }}
            style={[styles.actionButton, startDisabled && styles.actionButtonDisabled]}
          >
            <Text style={styles.actionLabel}>Start session</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={cancelDisabled}
            onPress={() => {
              void cancel();
            }}
            style={[styles.secondaryButton, cancelDisabled && styles.actionButtonDisabled]}
          >
            <Text style={styles.secondaryActionLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

function formatAmount(amount?: number): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "Pending";
  }

  return `$${amount.toFixed(2)}`;
}

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ");
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#f4f1ea",
    flex: 1,
  },
  container: {
    flex: 1,
    gap: 16,
    padding: 24,
  },
  eyebrow: {
    color: "#7a6d5a",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#1f2937",
    fontSize: 34,
    fontWeight: "700",
  },
  subtitle: {
    color: "#4b5563",
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fffdf8",
    borderColor: "#d6c7ae",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  label: {
    color: "#7a6d5a",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  value: {
    color: "#1f2937",
    fontSize: 16,
  },
  noticeCard: {
    backgroundColor: "#eef5ec",
    borderColor: "#9ab58d",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  errorCard: {
    backgroundColor: "#fff1ee",
    borderColor: "#d7a091",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  noticeTitle: {
    color: "#39513d",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  noticeText: {
    color: "#25352a",
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 999,
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#fffdf8",
    borderColor: "#d6c7ae",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    color: "#fffdf8",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionLabel: {
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "700",
  },
});
