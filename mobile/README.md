# LeadSig Tap to Pay Mobile Scaffold

This directory is a minimal React Native companion app shell for LeadSig's Tap to Pay flow.

Current scope:
- provides a focused `TapToPayHomeScreen`
- owns mobile-local tap-to-pay types and deep-link parsing
- accepts future `leadsig://tap-to-pay` handoff URLs
- includes a Stripe Terminal runtime adapter and Tap to Pay session orchestration
- still requires a real React Native Stripe Terminal runtime to complete in-person collection on device

## Files

- `src/App.tsx`: app entry that parses an incoming deep link
- `src/screens/TapToPayHomeScreen.tsx`: minimal Tap to Pay-only shell
- `src/types/tapToPay.ts`: deep-link and session parsing/types
- `src/types/tapToPay.test.ts`: mobile-local test coverage for handoff parsing
- `src/hooks/useStripeTerminal.ts`: adapter boundary for the native Stripe Terminal runtime
- `src/hooks/useTapToPaySession.ts`: mobile session state machine for create, collect, process, capture, and cancel flows

## Deep link shape

The scaffold currently recognizes URLs like:

`leadsig://tap-to-pay?invoiceId=inv_123&paymentIntentId=pi_123&sessionId=sess_123`

Supported query params today:
- `invoiceId`
- `paymentIntentId`
- `sessionId`
- `customerId`
- `amount`

## Current end-to-end shape

1. Web CRM creates a Stripe Terminal payment session through Supabase.
2. Web CRM generates a `leadsig://tap-to-pay` handoff link.
3. Mobile app parses the handoff and starts the Tap to Pay session state machine.
4. Native Stripe Terminal runtime is expected to initialize, collect, and process the payment.
5. Mobile app captures or cancels the payment through the new Supabase Terminal functions.
6. CRM `/payments` and payment detail pages show Tap to Pay method labels plus terminal troubleshooting metadata.

## Running the mobile-local test

From `/mobile`:

```bash
npm test
```

## Verification status in this workspace

- web handoff helpers and UI are covered by Vitest in the main app
- mobile session parsing/state orchestration is covered by Vitest in `/mobile`
- Supabase function logic was implemented, but real device validation is still pending here because this workspace does not have a running mobile simulator/device, Stripe Terminal runtime, or local Deno function environment

## Next steps

- install and configure Stripe Terminal React Native SDK in the actual mobile app
- wire native deep-link listeners for iOS and Android app shells
- test with a Stripe Terminal simulator and then a supported physical Tap to Pay device
- validate declined, canceled, disconnected-account, and unsupported-device paths end to end
