# Settings: Pricing, Pricing Rules & Stripe Payments

## Overview

This covers two distinct but related settings areas:

1. **Pricing & Pricing Rules** — define your baseline service rates and conditional adjustments so estimates are generated consistently.
2. **Stripe Payments** — connect your Stripe account so customers can pay invoices online and you can collect card payments directly.

---

## Pricing Settings

### What It Does

Pricing settings define the default rates used when building estimates. Instead of manually entering prices each time, estimates pull from these defaults automatically.

### How to Set It Up

1. Go to **Settings → Pricing** (`/settings/pricing`).
2. Set your baseline rates (e.g. hourly rate, flat rate per service type).
3. Go to **Settings → Pricing Rules** (`/settings/pricing-rules`).
4. Add conditional rules — for example: *add 20% for jobs over 2,000 sq ft* or *apply a $50 surcharge for steep terrain*.
5. Go to **Settings → Minimum Job Size** (`/settings/min-job-size`) and set the minimum dollar threshold you'll accept.
6. Test your setup by creating a sample estimate and verifying the numbers look right.

### Common Mistakes

| Mistake | Better Approach |
|---|---|
| Changing base pricing without checking your existing rules | After any pricing change, run through a few estimate scenarios to make sure rules still apply correctly |
| Handling exceptions manually instead of adding rules | If the same exception comes up more than once, create a rule for it |
| No record of when pricing changed | Keep a short internal changelog so your team knows what changed and when |

### Who Should Manage This

- **Owner / Admin** — set and own pricing policy
- **Sales** — apply pricing policy when building estimates, not redefine it

---

## Stripe Payments

### What It Does

Connecting Stripe lets you:

- Send invoices customers can pay online with a credit or debit card
- Collect payments on the spot during or after a job
- Have funds deposited directly to your bank account — LeadSig never holds your money

### Plan Requirement

Stripe Connect requires the **Basic plan or higher**.

### How to Connect

1. Go to **Settings → Payment Settings** (`/settings/stripe`).
2. Click **Connect Your Stripe Account**.
3. You'll be redirected to Stripe's onboarding flow — enter your business info, banking details, and any identity verification Stripe requires.
4. Once complete, you'll be returned to LeadSig and your account status will show **Connected**.

> Stripe handles all identity, banking, and tax verification on their end. You don't need a pre-existing Stripe account — one will be created during onboarding if you don't have one.

### Connection Statuses

| Status | What It Means |
|---|---|
| **Not Connected** | Stripe hasn't been linked yet. Invoices can be created but not paid online. |
| **Connected** | Ready to accept payments. |
| **Action Required** | Stripe needs additional info from you. Click into Stripe Dashboard to see what's needed. |
| **Pending** | Stripe is reviewing your account. Usually resolves within 1–2 business days. |

### Managing Your Connection

Once connected, from the Payment Settings page you can:

- **Open Stripe Dashboard** — view payouts, transactions, and account details directly in Stripe
- **Refresh Status** — manually re-check your connection status if it seems stale
- **Disconnect** — unlinks your Stripe account. You won't be able to accept payments until you reconnect.

### Disconnecting

Disconnecting does **not** delete past payment records or invoices. It only prevents new payments from being processed. You can reconnect at any time.

---

## Related Pages

- [Estimates](./2026-04-12-estimates.md) — where pricing defaults are applied
- [Invoices & Payments](./2026-04-12-invoices-and-payments.md) — how Stripe payments work on the invoice side
