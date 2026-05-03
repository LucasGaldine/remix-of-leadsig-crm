# Stripe Price ID Configuration

Set these secrets for `stripe-manage-subscription` to pin billing to explicit Stripe prices:

- `STRIPE_PRICE_BASIC_SOLO_MONTHLY`
- `STRIPE_PRICE_BASIC_TEAM_MONTHLY`
- `STRIPE_PRICE_BASIC_GROWTH_MONTHLY`
- `STRIPE_PRICE_PREMIUM_MONTHLY`
- Optional hard enforcement: `STRIPE_REQUIRE_CONFIGURED_PRICE_IDS=true`

Current Stripe test-mode IDs created for LeadSig:

- `STRIPE_PRICE_BASIC_SOLO_MONTHLY=price_1TT0B5DIuQIGhSEFHdGEjgws`
- `STRIPE_PRICE_BASIC_TEAM_MONTHLY=price_1TT0B6DIuQIGhSEFYcAhkDwI`
- `STRIPE_PRICE_BASIC_GROWTH_MONTHLY=price_1TT0B7DIuQIGhSEFx9z6s4sa`
- `STRIPE_PRICE_PREMIUM_MONTHLY=price_1TT0B8DIuQIGhSEFgXuvJIAg`

Example:

```bash
supabase secrets set \
  STRIPE_PRICE_BASIC_SOLO_MONTHLY=price_1TT0B5DIuQIGhSEFHdGEjgws \
  STRIPE_PRICE_BASIC_TEAM_MONTHLY=price_1TT0B6DIuQIGhSEFYcAhkDwI \
  STRIPE_PRICE_BASIC_GROWTH_MONTHLY=price_1TT0B7DIuQIGhSEFx9z6s4sa \
  STRIPE_PRICE_PREMIUM_MONTHLY=price_1TT0B8DIuQIGhSEFgXuvJIAg \
  STRIPE_REQUIRE_CONFIGURED_PRICE_IDS=true
```

Promotion-code testing notes:

- If `STRIPE_TEST_COUPON_ID` is set, Checkout auto-applies that coupon (best for guaranteed free upgrade tests).
- If `STRIPE_TEST_COUPON_ID` is not set, Checkout uses `allow_promotion_codes: true`.
- Checkout accepts **Promotion Codes** (customer-facing codes), not raw coupon IDs.
- Coupon currently created in test mode: `rPIiPvxz` (`LEADSIG_TEST_FREE_UPGRADE_MAY2026`, 100% off, once).
- Additional test coupon: `6lcTZOhO` (`LEADSIG_TEST_FREE_UPGRADE_MAY2026_B`, 100% off, once).
- Create a Promotion Code in Stripe Dashboard that points to coupon `rPIiPvxz`, then enter that code at checkout.
