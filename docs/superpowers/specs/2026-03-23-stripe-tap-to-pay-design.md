# Stripe Tap To Pay Design

## Purpose

This task defines the shared payment contract for the Stripe Terminal Tap to Pay flow. The web CRM remains the source of truth for payment records, while the mobile companion app creates and completes in-person Terminal payments against that shared contract.

## Contract

- Keep the existing web payment method value `tap-to-pay`.
- Add a terminal payment channel on `Payment` so a record can distinguish online versus in-person collection.
- Add a terminal lifecycle status model that is separate from the existing high-level payment status.
- Allow the UI layer to interpret both normalized terminal lifecycle states and raw Stripe `PaymentIntent.status` values persisted during reconciliation.
- Keep the contract additive. Existing card, cash, check, and ACH usage should continue to work unchanged.

## Shared Types

- `tapToPayPaymentMethods`: runtime constant for Tap to Pay-capable methods.
- `tapToPayStatuses`: runtime constant for the Terminal lifecycle states needed by the future mobile flow.
- `Payment`: extend with optional terminal tracking fields, including:
  - `paymentChannel`
  - `terminalStatus`
  - `stripeTerminalReaderId`
  - `stripeTerminalLocationId`
  - `stripeTerminalPaymentIntentId`

## Implemented Surface

- Supabase functions now create connection tokens, create Terminal payment intents, and reconcile capture/cancel outcomes back into `payments`.
- The web CRM `Charge Payment` flow creates a Tap to Pay handoff link instead of trying to collect the card in-browser.
- The `/payments` list and payment detail page now surface Tap to Pay method labels, terminal lifecycle messaging, and Stripe terminal troubleshooting identifiers.
- The mobile scaffold parses `leadsig://tap-to-pay` URLs and includes a session state machine plus a Stripe Terminal runtime adapter boundary.

## Out Of Scope

- Full real-device Stripe Terminal validation from this workspace.
- Native mobile app packaging and App Store / Play Store deployment.
- Production operational rollout steps for Stripe Tap to Pay eligibility.

## Acceptance Criteria

- The shared payment types export Tap to Pay constants and terminal lifecycle types.
- The `Payment` type can represent an in-person Terminal record without breaking existing web payment records.
- Tests cover the exported constants and the typed payment contract.

## Verification Notes

- Automated verification was completed in this workspace for the web handoff helpers/UI and the payments UI presentation layer.
- Real end-to-end Tap to Pay collection is still pending a supported iOS/Android device or simulator with the Stripe Terminal runtime installed.
