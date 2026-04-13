# Getting Started: Estimates

## Overview

Estimates in LeadSig let you define scope and price before work starts, send a professional quote to the client for approval, and then convert that approved estimate into scheduled work and invoices. Every estimate is tied to a specific job, carries a full line-item breakdown, and maintains a versioned history so you always know what the client approved.

---

## How Estimates Fit Into the Workflow

Estimates live inside the Payments area but they bridge across three areas of the platform:

```
Lead → Job → Estimate → Approval → Invoice / Scheduled Job
```

- A **job** must exist before you can create an estimate — the estimate is scoped to that job.
- One estimate per job. If a job already has an estimate, it won't appear in the "Create Estimate" job picker.
- Once approved, the estimate drives what gets invoiced and what the crew is scheduled to do.
- Change orders extend an approved estimate without discarding the original approved scope.

---

## Creating an Estimate

Navigate to **Payments → Create Estimate** (`/payments/estimates/new`).

### 1. Select a Job

The job picker shows only jobs in `job`, `paid`, or `completed` status that don't already have an estimate. The customer is pulled automatically from the job — you don't need to enter it separately.

> If no jobs appear, all eligible jobs already have estimates. Go to Jobs and create a new job first.

### 2. Voice Intake (Optional)

Click **Voice Estimate Intake** to dictate the full estimate instead of filling in fields manually. You can say the job name, line items with quantities and prices, notes, expiration date, and tax/discount values. The system will match the spoken job name to an existing job and populate all fields.

Example dictation:
> "Estimate for the Carter roof wash job, expires next Friday. Add 2 line items: roof wash 1 each 900 dollars, gutter flush 1 each 250 dollars. Notes: 30% deposit required."

### 3. Set Expiration Date and Notes

- **Expiration date** — When set, the estimate will automatically move to `expired` status after this date. The client's portal link will show as expired.
- **Notes** — Customer-facing text that appears at the bottom of the estimate and on the PDF.

### 4. Build Line Items

Each line item has:

| Field | Notes |
|---|---|
| **Name** | Required. What you're charging for (e.g., "Labor", "Roof Wash", "Equipment Rental") |
| **Description** | Optional detail. Supports speech-to-text input. |
| **Quantity** | Supports decimals. |
| **Unit** | Each, Hour, Sq Ft, Linear Ft, or Day |
| **Unit Price** | Price per unit. Total auto-calculates. |
| **Category** | Equipment, Materials, Labor, or Other — controls grouping on the detail view and PDF |

Line items are displayed and grouped by category: Equipment → Materials → Labor → Other.

### 5. Review Totals

The totals section calculates in this order:

```
Subtotal (sum of all line items)
+ Profit Margin (account default, applied as a % on top of subtotal)
+ Tax (applied to the subtotal + profit margin, at the specified rate)
- Discount (flat dollar amount)
= Total
```

Tax rate defaults to your account's default tax rate. You can override it per estimate. Profit margin comes from your account settings and is not separately visible to the client — it's folded into your pricing.

---

## The Estimate Detail Page

After creating an estimate, you land on its detail page (`/payments/estimates/:id`). This is where the full lifecycle is managed.

### Status Flow

```
draft → sent → viewed → accepted
                       → declined
                       → expired
```

| Status | What it means |
|---|---|
| **Draft** | Created but not sent. Only visible internally. |
| **Sent** | A client portal link has been generated and shared. |
| **Viewed** | The client opened the portal link. |
| **Accepted** | Approved — either by the client through the portal, or manually by your team. |
| **Declined** | The client declined through the portal. |
| **Expired** | The expiration date has passed without approval. |

### Versions

Every estimate supports named snapshots called **versions**. Version 1 is created automatically when you save the estimate.

Versions let you:
- Maintain alternative pricing options (e.g., "Basic Package" vs "Full Service")
- Track what the estimate looked like at different points in time
- Select which version to send to the client for approval

To create a new version from the current line items, click **Save Version** on the detail page and give it a name. Versions can be renamed or deleted. The version history is ordered chronologically, and you can switch between versions to preview how the totals and line items differ.

> Versions are read-only snapshots. Editing the estimate after saving a version does not retroactively modify past versions.

When sending an estimate, you select which version to send. The client sees and approves that specific version's pricing and line items.

### Sending to the Client

From the detail page, click **Send** to generate a **client portal link**. This link:

- Is unique to the estimate and tied to a secure token
- Lets the client view the full estimate (line items, totals, notes, company branding)
- Lets the client approve or decline with a single click
- Updates the estimate status in real time when the client acts

You can share the link manually via text or email from the portal dialog, or enter the client's phone/email to send it directly.

The estimate status moves from `draft` → `sent` when the link is generated, and then to `viewed` automatically when the client opens it.

### Manual Approval

If the client approves verbally, in person, or via paper signature, you can mark the estimate as approved manually from the detail page. You can optionally attach a photo (e.g., a signed document or on-site confirmation) as proof of approval. This photo is stored and appears on the PDF.

### Downloading the PDF

The **Download PDF** button generates a formatted estimate PDF that includes:
- Your company name, logo, email, and phone
- Customer name, job address, and service type
- Full line-item breakdown grouped by category
- Totals (subtotal, tax, discount, final total)
- Notes
- Expiration date
- Approval signature photo (if manually approved)

The PDF reflects whichever version is currently selected, not necessarily the live estimate state.

---

## After Approval

Once an estimate is in `accepted` status, two downstream actions become available:

### Convert to Invoice

Creates an invoice pre-populated with the approved estimate's line items and totals. Continues in [Invoices & Payments](./2026-04-12-invoices-and-payments.md).

### Create a Job from Approved Scope

Links the approved scope to a scheduled job. The crew sees what was approved and works from that. Continues in [Jobs & Scheduling](./2026-04-12-jobs-and-scheduling.md).

---

## Change Orders

If scope changes after the estimate is approved, you don't need to void and recreate it. Change orders let you modify the approved estimate while preserving the original approved values.

Change order line items are flagged with:
- `added` — a new item added after approval
- `edited` — a previously approved item with updated quantity or price
- `deleted` — an approved item that was removed

The detail page shows the original approved totals alongside the pending change order totals. Change orders can be sent to the client for re-approval through the same portal flow. Until a change order is approved, the estimate shows a "pending changes" state. You can toggle between the original approved view and the current pending view.

---

## Recurring Quotes

An estimate can also be linked to a **recurring job** rather than a one-time job. These are displayed as "Quote" rather than "Estimate" and follow the same approval flow — the client portal link, versioning, approval, and PDF all work the same way.

---

## Where to Find Estimates

- **Payments page** (`/payments`) — lists all estimates with status badges and quick filters
- **Estimate detail** (`/payments/estimates/:id`) — full lifecycle management for one estimate
- **Job detail** — shows the linked estimate card with current status and totals
- **Customer detail** — shows all estimates for that customer across jobs

Estimates update in real time across all views via Supabase Realtime subscriptions.

---

## Role and Permission Notes

| Role | Access |
|---|---|
| `owner`, `admin` | Full control — create, edit, send, approve, convert, delete |
| `sales` | Creates and manages estimates through approval |
| `crew_lead`, `crew_member` | Sees approved scope via the job record, not the estimate directly |

---

## Common Mistakes and How to Avoid Them

**Mistake:** Creating an estimate before the job exists.
**Fix:** Estimates require a job. Create the job first, then the estimate.

**Mistake:** Sending an estimate without selecting the right version.
**Fix:** Review the version selector on the detail page before sending. The client sees exactly the version you select.

**Mistake:** Editing pricing after the client has approved.
**Fix:** Use change orders for post-approval scope changes. Editing the base estimate after approval is tracked and surfaces a "pending changes" warning.

**Mistake:** Leaving approved estimates unconverted for days.
**Fix:** Build a daily habit of checking the Payments page for `accepted` estimates and converting them to invoices or scheduled jobs the same day.

**Mistake:** Sending with a missing expiration date on time-sensitive quotes.
**Fix:** Set an expiration date whenever pricing is contingent on material costs, availability, or promotional terms. The system will automatically expire the estimate and stop accepting approvals after that date.
