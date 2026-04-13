# Getting Started: Invoices & Payments

## Overview

The Payments hub (`/payments`) is the central place for managing all billing activity — estimates, invoices, and recorded payments — in one unified view. It covers the full lifecycle from a signed-off estimate to collected revenue.

---

## How the Hub Is Organized

The Payments page groups activity into three object types, selectable via the tab chips at the top:

| Tab | What it shows |
|---|---|
| **All** | Unified feed of estimates, invoices, and payments sorted together |
| **Estimates** | Quotes in progress or awaiting review after a site visit |
| **Invoices** | Billing documents sent to customers |
| **Payments** | Individual payment records tied to invoices |

At the top of the "All" view, a **Needs Review** banner appears when any estimate has had a site visit completed but hasn't yet been accepted or declined. Tapping it filters the estimates tab to only those records.

The header subtitle shows **total collected this month** (sum of all `completed` payments) as a live summary.

---

## The End-to-End Billing Flow

The billing process in LeadSig follows a strict sequence. Each step depends on the one before it.

```
Lead → Estimate (draft → sent → accepted) → Invoice → Payment
```

### Step 1 — Estimate is accepted

An invoice can only be created from an estimate with status `accepted`. Attempting to create one from a `draft`, `sent`, or `declined` estimate is blocked with a validation error. See [Estimates](./2026-04-12-estimates.md) for managing the estimate lifecycle.

### Step 2 — Create an invoice

From the accepted estimate's detail page, tap **Create Invoice**. This navigates to `/payments/invoices/new?estimateId=<id>`.

The create flow (`src/pages/CreateInvoice.tsx`) automatically:

- Pre-fills the **invoice amount** as the remaining uninvoiced balance (estimate total minus any previously created invoices against the same estimate).
- Defaults the **due date** to 30 days from today.
- Copies line items from the estimate, scaled proportionally if you invoice for a partial amount.
- Calculates tax and discount using the same rates as the estimate.

**Partial invoicing is supported.** You can create multiple invoices against a single estimate as long as the total doesn't exceed the estimate value. The form shows how much has already been invoiced and what remains.

You have two options when saving:

| Action | What happens |
|---|---|
| **Save as Draft** | Invoice saved with status `draft`. Not sent to the customer. You can edit it before sending. |
| **Send via Stripe** | Invoice created with status `sent` and immediately dispatched to the customer's email via the `stripe-connect-invoice` Edge Function. Requires the customer to have an email address on file. |

### Step 3 — Invoice lifecycle

Once created, invoices move through a defined set of statuses:

| Status | Meaning |
|---|---|
| `draft` | Created but not yet sent |
| `sent` | Dispatched to the customer |
| `viewed` | Customer has opened the invoice link |
| `partial` | A payment has been recorded but balance remains |
| `paid` | Fully paid — balance due is zero |
| `overdue` | Past the due date with outstanding balance |

The invoice detail page (`/payments/invoices/:id`) renders the current status as a badge. The balance due is tracked separately from the total — it decreases as payments are recorded.

### Step 4 — Collect payment

From the invoice detail page, two collection actions are available:

**Copy Pay Link** — Copies a public-facing payment URL (`/pay/invoice/:id`) to your clipboard. Send this to the customer manually. They can pay through the hosted page without logging in.

**Charge Now** — Opens the payment options modal, which supports:

| Method | How it works |
|---|---|
| **Credit/Debit Card** | Requires Stripe to be connected. Opens a secure Stripe Checkout page for the customer. |
| **Cash** | Records the payment locally with optional notes. No Stripe required. |
| **Check** | Records the payment locally. You can enter a check number for reference. |
| **ACH Transfer** | Requires a connected payment processor. |
| **Tap to Pay** | Contactless in-person payment. Currently coming soon. |

You can also navigate directly to `/payments/charge` from anywhere in the app to start a charge flow. If you arrive via the invoice detail page, the customer, amount, and method are pre-filled.

### Step 5 — Payment recorded

Each payment is stored in the `payments` table with a link back to its invoice, customer, and job. Payment records track:

- Amount and method
- Status: `pending`, `completed`, `failed`, or `refunded`
- Stripe-specific fields (payment intent ID, terminal reader/location IDs, receipt URL) when applicable
- Transaction reference for non-Stripe methods

The payment detail page (`/payments/:id`) shows all of this plus a **View Receipt** button (if a Stripe receipt URL is present) and a link back to the related invoice.

---

## Actions Available on the Invoice Detail Page

| Action | Description |
|---|---|
| **Download PDF** | Generates and downloads a PDF invoice using company branding, line items, and totals via `src/lib/pdfGenerator.ts`. |
| **Copy Pay Link** | Copies the public `/pay/invoice/:id` URL to the clipboard. |
| **Charge Now** | Opens the payment collection modal for the outstanding balance. |
| **View in Stripe** | Links directly to the Stripe dashboard for this invoice (only visible if a `stripe_invoice_id` is present). |
| **Resync with Stripe** | Forces a re-sync of payment data between LeadSig and Stripe if the records have drifted (visible for Stripe-linked invoices only). |

---

## Filtering and Sorting

### Invoice aging filter

When on the **Invoices** tab, a second row of filters appears for aging:

| Filter | Maps to |
|---|---|
| All | All invoices |
| 0–7 days | Non-overdue invoices |
| 8–30 days | Invoices with `partial` status |
| 31+ days | Invoices with `overdue` status |

### Sort options

All tabs support sorting by: newest, oldest, amount high-to-low, amount low-to-high, customer A–Z, customer Z–A.

### Search

The search bar filters by customer name and job name across all three object types simultaneously.

---

## Exporting Financial Data

The floating action button on the Payments hub opens the **Export Data** modal (`ExportInvoicesModal`). This lets you download invoice and payment data as a CSV for accounting or reporting purposes. See also [Reporting & Data Export](./2026-04-12-reporting-and-data-export.md).

---

## Key Routes

| Route | Component | Purpose |
|---|---|---|
| `/payments` | `Payments.tsx` | Hub: estimates, invoices, payments |
| `/payments/invoices/new?estimateId=<id>` | `CreateInvoice.tsx` | Create invoice from an accepted estimate |
| `/payments/invoices/:id` | `InvoiceDetail.tsx` | View, send, charge, download a specific invoice |
| `/payments/charge` | `ChargePayment.tsx` | Standalone charge flow with customer/method selection |
| `/payments/:id` | `PaymentDetail.tsx` | View a specific payment record |

---

## Data Layer

- `useInvoices()` / `useInvoice(id)` — `src/hooks/useInvoices.ts` — fetch invoices with joined customer, job, and line item data. Both subscribe to Supabase Realtime so invoice status changes reflect instantly.
- `usePayments()` / `usePayment(id)` — `src/hooks/usePayments.ts` — fetch payments with joined customer, job, and invoice data. Also Realtime-subscribed.
- Stripe integration is handled by the `stripe-connect-invoice` Edge Function (`supabase/functions/`).
- Invoice numbers are auto-generated via the `get_next_invoice_number` PostgreSQL function.

---

## Role and Permission Notes

- **`owner` / `admin`**: Full access to create, send, charge, and export.
- **`sales`**: Can prepare invoices where policy allows, but payment collection controls should remain restricted.
- **`crew_lead` / `crew_member`**: No access to billing. The crew dashboard is a separate surface.

---

## Common Mistakes

**Invoicing before estimate is accepted.**
The system blocks this, but make sure the customer has formally accepted the estimate before proceeding. Don't skip the estimate step just to generate a quick invoice.

**Invoicing over the estimate total.**
The form enforces this, but be aware that if multiple invoices exist against the same estimate, the remaining balance shown accounts for all of them — not just the current one.

**Sending via Stripe without a customer email.**
Stripe delivery will fail silently unless the customer record has a valid email. Always verify the email on the customer profile before using "Send via Stripe."

**Marking a payment recorded without evidence.**
Cash and check payments are recorded on your word. Note the check number and attach any relevant context in the notes field so the record can be reconciled later.

**Letting invoices age past due without follow-up.**
Use the aging filter (8–30 days, 31+) to triage overdue invoices regularly. The system doesn't send automatic reminders — follow-up is manual.
