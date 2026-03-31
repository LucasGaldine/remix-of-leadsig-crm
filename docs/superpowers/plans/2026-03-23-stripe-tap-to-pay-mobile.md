# Stripe Tap To Pay Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real Stripe Tap to Pay flow by adding a small React Native companion app that uses Stripe Terminal and logs completed in-person payments back into the existing Supabase-backed CRM.

**Architecture:** Keep the current Vite web app as the CRM and payments back office. Add a separate React Native mobile client for field collection, plus new Supabase Edge Functions that issue Stripe Terminal connection tokens, create Terminal-compatible PaymentIntents, and reconcile successful Tap to Pay charges into the existing `payments` table. The web app only launches and monitors the flow; all actual Tap to Pay card collection happens in the mobile app, because Stripe Terminal Tap to Pay is not supported in a plain browser app.

**Tech Stack:** Vite React web app, React Native, Stripe Terminal React Native SDK, Supabase Edge Functions, Supabase Postgres, Vitest, TypeScript

---

## File Structure

**Existing files to modify**
- `src/pages/ChargePayment.tsx`
  Add a web-side Tap to Pay handoff entry, mobile handoff copy, and status-aware messaging.
- `src/hooks/useStripeConnect.ts`
  Add client helpers for new Tap to Pay server endpoints without mixing them into the existing hosted checkout flow.
- `src/types/payments.ts`
  Extend payment method/status typing to support in-person Terminal/Tap to Pay tracking.
- `supabase/functions/stripe-connect-payment/index.ts`
  Leave hosted card checkout intact, but avoid overloading this function with Terminal-specific behavior.

**New web files**
- `src/lib/tapToPay.ts`
  Shared web-side helpers for deep link generation, handoff payload shaping, and polling/reconciliation rules.
- `src/test/tapToPay.test.ts`
  Unit tests for the handoff payload, supported states, and redirect/deep-link formatting.

**New mobile app files**
- `mobile/package.json`
  React Native app manifest and scripts.
- `mobile/src/App.tsx`
  Mobile entry point for the Tap to Pay companion app.
- `mobile/src/screens/TapToPayHomeScreen.tsx`
  Main screen to receive a payment handoff and guide the user through reader discovery and collection.
- `mobile/src/hooks/useStripeTerminal.ts`
  Wrap Stripe Terminal React Native SDK initialization, discovery, connection, collection, and processing.
- `mobile/src/hooks/useTapToPaySession.ts`
  Fetch and manage server-issued session data, connection tokens, and completion callbacks.
- `mobile/src/lib/api.ts`
  Authenticated calls from mobile to Supabase Edge Functions.
- `mobile/src/types/tapToPay.ts`
  Shared mobile-side request/response types.
- `mobile/src/__tests__/tapToPaySession.test.ts`
  Unit tests for session parsing and completion payload handling.
- `mobile/README.md`
  Local setup instructions for iOS/Android, Stripe Terminal simulator, and environment variables.

**New backend files**
- `supabase/functions/stripe-terminal-connection-token/index.ts`
  Create Stripe Terminal connection tokens for the mobile app.
- `supabase/functions/stripe-terminal-create-payment/index.ts`
  Create Tap to Pay PaymentIntents for the connected Stripe account and write a pending `payments` row.
- `supabase/functions/stripe-terminal-capture-payment/index.ts`
  Mark the `payments` record complete after successful in-person collection/processing and persist Stripe identifiers.
- `supabase/functions/stripe-terminal-cancel-payment/index.ts`
  Cancel abandoned/failed Tap to Pay sessions and update the local payment row.
- `supabase/migrations/20260323_add_terminal_payment_tracking.sql`
  Add any missing `payments` columns needed for Terminal lifecycle tracking.

**Optional follow-up files**
- `src/pages/Payments.tsx`
  Display Tap to Pay / in-person payment method badges if not already handled by existing generic payment display.
- `src/pages/PaymentDetail.tsx`
  Show Terminal-specific Stripe references when viewing a payment.

---

### Task 1: Define The Payment Tracking Contract

**Files:**
- Create: `docs/superpowers/specs/2026-03-23-stripe-tap-to-pay-design.md`
- Modify: `src/types/payments.ts`
- Create: `src/test/tapToPay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { tapToPayPaymentMethods, tapToPayStatuses } from "@/types/payments";

describe("tap to pay payment typing", () => {
  it("includes tap to pay as an in-person payment method", () => {
    expect(tapToPayPaymentMethods).toContain("tap_to_pay");
  });

  it("includes terminal lifecycle statuses", () => {
    expect(tapToPayStatuses).toEqual(
      expect.arrayContaining(["terminal_pending", "terminal_processing", "completed", "failed", "canceled"]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/tapToPay.test.ts`
Expected: FAIL because the new exports/types do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add explicit exported constants/types in `src/types/payments.ts`, for example:

```ts
export const tapToPayPaymentMethods = ["tap_to_pay"] as const;
export const tapToPayStatuses = [
  "terminal_pending",
  "terminal_processing",
  "completed",
  "failed",
  "canceled",
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/tapToPay.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-03-23-stripe-tap-to-pay-design.md src/types/payments.ts src/test/tapToPay.test.ts
git commit -m "plan: define tap to pay payment contract"
```

### Task 2: Add Database Fields For Terminal Payments

**Files:**
- Create: `supabase/migrations/20260323_add_terminal_payment_tracking.sql`
- Test: manual SQL verification via Supabase branch or local project

- [ ] **Step 1: Write the failing schema verification**

Prepare a verification query that expects new columns to exist:

```sql
select
  column_name
from information_schema.columns
where table_name = 'payments'
  and column_name in (
    'payment_channel',
    'stripe_terminal_reader_id',
    'stripe_terminal_location_id',
    'stripe_terminal_payment_intent_status'
  );
```

- [ ] **Step 2: Run verification to confirm columns are missing**

Run against the development database before migration.
Expected: fewer than 4 rows returned.

- [ ] **Step 3: Write minimal migration**

Add only the fields needed to support Tap to Pay tracking:

```sql
alter table public.payments add column if not exists payment_channel text;
alter table public.payments add column if not exists stripe_terminal_reader_id text;
alter table public.payments add column if not exists stripe_terminal_location_id text;
alter table public.payments add column if not exists stripe_terminal_payment_intent_status text;
```

Also add comments and, if appropriate, a lightweight check constraint for `payment_channel in ('online','terminal')`.

- [ ] **Step 4: Apply migration and rerun verification**

Run the migration, then rerun the verification query.
Expected: all required columns exist.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260323_add_terminal_payment_tracking.sql
git commit -m "feat: add payment tracking fields for tap to pay"
```

### Task 3: Create Stripe Terminal Connection Token Function

**Files:**
- Create: `supabase/functions/stripe-terminal-connection-token/index.ts`
- Test: function invocation from authenticated client

- [ ] **Step 1: Write the failing test or request contract**

Document the expected response shape:

```json
{
  "secret": "pst_..."
}
```

And expected failure when Stripe is not connected:

```json
{
  "error": "Stripe account not connected or not enabled for charges"
}
```

- [ ] **Step 2: Invoke a placeholder function name to verify failure**

Run an authenticated invoke for `stripe-terminal-connection-token`.
Expected: function not found or not deployed.

- [ ] **Step 3: Write minimal implementation**

Mirror the auth/account lookup pattern from `supabase/functions/stripe-connect-payment/index.ts`, then create a Stripe Terminal connection token:

```ts
const connectionToken = await stripe.terminal.connectionTokens.create();
return new Response(JSON.stringify({ secret: connectionToken.secret }), ...);
```

Important: use the platform secret key and authenticated account lookup. Do not store connection tokens in the database.

- [ ] **Step 4: Deploy and verify**

Invoke the function from an authenticated session.
Expected: `200` with `{ secret: ... }`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-terminal-connection-token/index.ts
git commit -m "feat: add stripe terminal connection token function"
```

### Task 4: Create Terminal PaymentIntent Function

**Files:**
- Create: `supabase/functions/stripe-terminal-create-payment/index.ts`
- Modify: `src/hooks/useStripeConnect.ts`
- Create: `src/lib/tapToPay.ts`
- Test: `src/test/tapToPay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildTapToPayPayload } from "@/lib/tapToPay";

describe("buildTapToPayPayload", () => {
  it("marks the payment as terminal-based", () => {
    expect(
      buildTapToPayPayload({
        amount: 125,
        invoiceId: "inv_123",
        customerId: "cust_123",
      }).channel,
    ).toBe("terminal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/tapToPay.test.ts`
Expected: FAIL because `buildTapToPayPayload` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/tapToPay.ts`:

```ts
export function buildTapToPayPayload(input: { amount: number; invoiceId: string; customerId: string }) {
  return {
    ...input,
    channel: "terminal",
    paymentMethod: "tap_to_pay",
  };
}
```

In `supabase/functions/stripe-terminal-create-payment/index.ts`:
- authenticate user
- resolve active account
- validate Stripe Connect readiness
- create a Stripe PaymentIntent suitable for Terminal / card-present collection
- insert a pending `payments` row with `payment_channel = 'terminal'`

In `src/hooks/useStripeConnect.ts`:
- add `createTapToPayPaymentSession`
- keep it separate from `createPaymentSession`

- [ ] **Step 4: Run tests and function verification**

Run:
- `npm test -- src/test/tapToPay.test.ts`
- invoke the new edge function manually with sandbox inputs

Expected:
- test passes
- function returns PaymentIntent identifiers needed by the mobile app

- [ ] **Step 5: Commit**

```bash
git add src/lib/tapToPay.ts src/hooks/useStripeConnect.ts src/test/tapToPay.test.ts supabase/functions/stripe-terminal-create-payment/index.ts
git commit -m "feat: create tap to pay payment session flow"
```

### Task 5: Create Terminal Completion And Cancellation Functions

**Files:**
- Create: `supabase/functions/stripe-terminal-capture-payment/index.ts`
- Create: `supabase/functions/stripe-terminal-cancel-payment/index.ts`
- Test: function invocation with sandbox PaymentIntent ids

- [ ] **Step 1: Write the failing request contracts**

Capture contract:

```json
{
  "paymentIntentId": "pi_123",
  "invoiceId": "inv_123",
  "readerId": "tmr_123",
  "locationId": "tml_123"
}
```

Cancel contract:

```json
{
  "paymentIntentId": "pi_123"
}
```

- [ ] **Step 2: Invoke the endpoints before creation**

Expected: missing function failure.

- [ ] **Step 3: Write minimal implementation**

Capture function responsibilities:
- retrieve/confirm final PaymentIntent state from Stripe
- update the matching `payments` row to `completed`
- save `stripe_terminal_reader_id`, `stripe_terminal_location_id`, and final terminal status

Cancel function responsibilities:
- cancel the PaymentIntent where possible
- mark the matching `payments` row `canceled` or `failed`

- [ ] **Step 4: Verify**

Invoke with sandbox/test identifiers or simulator-driven flow.
Expected: payment rows transition from pending to completed/canceled correctly.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-terminal-capture-payment/index.ts supabase/functions/stripe-terminal-cancel-payment/index.ts
git commit -m "feat: add tap to pay payment reconciliation functions"
```

### Task 6: Scaffold The Mobile Tap To Pay App

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/src/App.tsx`
- Create: `mobile/src/screens/TapToPayHomeScreen.tsx`
- Create: `mobile/src/types/tapToPay.ts`
- Create: `mobile/README.md`

- [ ] **Step 1: Write the failing smoke test**

Create a minimal mobile unit test:

```ts
import { describe, expect, it } from "vitest";
import { parseTapToPayLink } from "../src/types/tapToPay";

describe("parseTapToPayLink", () => {
  it("extracts session identifiers from deep links", () => {
    expect(parseTapToPayLink("leadsig://tap-to-pay?invoiceId=inv_1")).toMatchObject({
      invoiceId: "inv_1",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the mobile test command after scaffolding the package without implementation.
Expected: FAIL because parsing helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

Set up:
- React Native app shell
- deep-link entry point for `leadsig://tap-to-pay`
- home screen that displays session state and device readiness
- parsing helper for incoming handoff params

- [ ] **Step 4: Run smoke test**

Run the mobile test command.
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat: scaffold mobile tap to pay app"
```

### Task 7: Integrate Stripe Terminal React Native SDK

**Files:**
- Create: `mobile/src/hooks/useStripeTerminal.ts`
- Create: `mobile/src/hooks/useTapToPaySession.ts`
- Modify: `mobile/src/screens/TapToPayHomeScreen.tsx`
- Create: `mobile/src/__tests__/tapToPaySession.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { mapTerminalState } from "../src/hooks/useTapToPaySession";

describe("mapTerminalState", () => {
  it("maps sdk processing state to terminal_processing", () => {
    expect(mapTerminalState("processing")).toBe("terminal_processing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the mobile test command.
Expected: FAIL because the hook/helper does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement:
- connection-token fetcher
- Terminal SDK initialization
- Tap to Pay discovery/connect flow
- collect payment method
- process payment
- completion callback to Supabase capture function
- cancellation callback for abandoned sessions

Keep SDK wrapper logic in `useStripeTerminal.ts` and business/session logic in `useTapToPaySession.ts`.

- [ ] **Step 4: Run tests and simulator verification**

Run the mobile tests, then verify a simulated reader flow in Stripe sandbox.
Expected: successful simulated payment path and successful cancellation path.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks mobile/src/screens mobile/src/__tests__
git commit -m "feat: add stripe terminal tap to pay mobile flow"
```

### Task 8: Add Web Handoff Into The Existing CRM

**Files:**
- Modify: `src/pages/ChargePayment.tsx`
- Modify: `src/hooks/useStripeConnect.ts`
- Modify: `src/lib/tapToPay.ts`
- Test: `src/test/tapToPay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createTapToPayDeepLink } from "@/lib/tapToPay";

describe("createTapToPayDeepLink", () => {
  it("creates a leadsig deep link for the mobile app", () => {
    expect(createTapToPayDeepLink({ invoiceId: "inv_1" })).toContain("leadsig://tap-to-pay");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/tapToPay.test.ts`
Expected: FAIL because deep-link creation is not implemented.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/ChargePayment.tsx`:
- replace the fake Tap to Pay path
- create a Terminal payment session through the new hook
- generate a deep link / QR handoff to the mobile app
- show clear unsupported-device messaging on desktop-only environments

Do not pretend the browser itself can collect Tap to Pay.

- [ ] **Step 4: Run tests and manual web verification**

Run:
- `npm test -- src/test/tapToPay.test.ts`
- manual verification in the browser that Tap to Pay now creates a handoff instead of hosted checkout

Expected:
- tests pass
- web app starts the mobile handoff correctly

- [ ] **Step 5: Commit**

```bash
git add src/pages/ChargePayment.tsx src/hooks/useStripeConnect.ts src/lib/tapToPay.ts src/test/tapToPay.test.ts
git commit -m "feat: add crm handoff for tap to pay mobile app"
```

### Task 9: Expose Tap To Pay Results In Payments UI

**Files:**
- Modify: `src/pages/Payments.tsx`
- Modify: `src/pages/PaymentDetail.tsx`
- Modify: `src/components/payments/PaymentCard.tsx`

- [ ] **Step 1: Write the failing test**

Add a UI-level unit test or formatter test that expects `tap_to_pay` payments to render as an in-person Stripe payment with terminal metadata if present.

- [ ] **Step 2: Run test to verify it fails**

Run the targeted test command.
Expected: FAIL because the UI does not distinguish Tap to Pay payments yet.

- [ ] **Step 3: Write minimal implementation**

Update the payments UI to:
- show `Tap to Pay` as the method label
- show terminal/completed/pending status cleanly
- optionally surface reader/location ids on the detail page for troubleshooting

- [ ] **Step 4: Run tests and verify UI**

Run the targeted tests and manually inspect sample payments.
Expected: Tap to Pay payments are clearly identifiable in the app.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Payments.tsx src/pages/PaymentDetail.tsx src/components/payments/PaymentCard.tsx
git commit -m "feat: surface tap to pay payments in ui"
```

### Task 10: End-To-End Verification

**Files:**
- Modify: `mobile/README.md`
- Modify: `docs/superpowers/specs/2026-03-23-stripe-tap-to-pay-design.md`

- [ ] **Step 1: Verify sandbox setup**

Run through:
- Stripe Connect account connected and charge-enabled
- iOS or Android test device eligible for Tap to Pay
- Stripe Terminal simulator working

- [ ] **Step 2: Verify happy path**

Test:
1. Start Tap to Pay from web CRM
2. Open mobile app via handoff
3. Discover/connect Tap to Pay reader
4. Collect/process simulated payment
5. Confirm `payments` row is `completed`

Expected: payment shows in `/payments` with Tap to Pay method.

- [ ] **Step 3: Verify failure paths**

Test:
1. cancel before collect
2. declined simulated card
3. disconnected Stripe account
4. unsupported mobile device

Expected: graceful failure and correct local payment status updates.

- [ ] **Step 4: Update operational docs**

Add:
- environment variables
- Stripe dashboard prerequisites
- supported-device notes
- local mobile development steps
- simulator notes

- [ ] **Step 5: Commit**

```bash
git add mobile/README.md docs/superpowers/specs/2026-03-23-stripe-tap-to-pay-design.md
git commit -m "docs: finalize tap to pay setup and verification notes"
```

