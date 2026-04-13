# Client Portal & Sharing

## Overview

The Client Portal is a branded, public-facing web experience you share with customers via a secure link. Clients can view their jobs, review and approve estimates, track schedules, pay invoices, and see before/after photos — all without logging into your account. No app download or account creation is required on the client's end.

## How Access Works

Client portal links are token-based. Each customer gets a unique, shareable URL that grants them read-only access to their own data.

- **Customer-level link**: Shows the client an overview of all their jobs, recurring services, and outstanding invoices in one place.
- **Job-level link**: Links directly to a single job's detail view — useful when sharing a specific estimate or update.

Links are generated from the **Customer detail page** using the "Client Portal Link" panel. Once generated, you can copy the link and send it via any channel (SMS, email, messaging). Generating a "New Link" immediately revokes the old one.

## What Clients See

### Customer Overview (when opened without a specific job)

When a client opens their portal link, they land on a branded welcome screen showing:

- Your **company logo** and **company name**
- A personalized greeting with the client's name
- **Invoices** — all outstanding and paid invoices with their status and a direct link to pay or view the Stripe receipt
- **Your Jobs** — a list of all one-time jobs with their current status (Pending, Scheduled, In Progress, Completed, Paid)
- **Recurring Services** — any recurring jobs with their frequency (weekly, monthly, etc.)

Clients can tap or click any job to drill into its full detail view.

### Job Detail View

Each job detail view is organized into sections:

#### Header
Displays your company logo (or name), the job name, service type, job address, a live status badge, and the current estimate total. If a project description was added internally, it appears here.

**Status labels** update automatically based on the job's state and scheduled dates:
- **Pending** — job created, not yet scheduled
- **Scheduled** — scheduled date is in the future
- **In Progress** — current time falls within the scheduled window
- **Completed** — all scheduled dates have passed, or status is marked complete
- **Paid** — invoice has been paid

#### Scheduled Dates
Lists all scheduled appointments for the job, including estimate visit appointments and service dates. Each entry shows the date, start/end time (if set), and whether it's been completed. Past dates are marked "Done"; upcoming dates are highlighted.

#### Estimate
Clients can review the full itemized estimate including:
- All line items with quantity, unit, unit price, and totals
- Subtotal, tax rate, discount, and grand total
- Notes from your team
- A **Download PDF** button to save a copy

**Approving or declining:** If the estimate is still pending, the client sees Approve and Decline buttons directly in the portal. No phone call or email needed.

**Multiple estimate versions:** If you created multiple pricing options (e.g., "Basic Package" vs. "Premium Package"), the client sees each option as a card they can compare side by side before selecting one to approve.

**Change orders:** If you modify a previously approved estimate, the client is shown both the original approved version and the proposed changes side by side. They can approve or decline the changes directly from the portal.

#### Invoice
If an invoice has been sent via Stripe, a payment card appears showing the invoice status (Payment Due or Paid) and a button that takes the client directly to Stripe to pay or view their receipt.

#### Photos
Before and after photos uploaded to the job are displayed in a grid organized by category. Clients can tap any photo to open a full-screen lightbox preview.

#### Activity Feed
A timeline of key touchpoints logged against the job — notes, calls, emails, messages, and status changes — giving clients visibility into recent activity without exposing internal-only details.

#### Review Request
When a job reaches a completed state, a prompt appears asking the client if they'd like to leave a review. They can dismiss it if they prefer not to.

## Branding and Theming

The portal uses your company's branding automatically:

- Your **logo** appears in the portal header
- The **portal color** and **text color** from Settings → Company Profile are applied to buttons, headers, and accents throughout the portal

To customize these colors, go to [Settings → Company Profile](./2026-04-12-settings-company-profile.md).

## Generating and Managing Share Links

1. Open the **Customer detail page** for the client.
2. Find the **Client Portal Link** panel.
3. Click **Generate Share Link** if no link exists yet.
4. Click **Copy Link** to copy the URL to your clipboard.
5. Send it to the client through any channel — SMS, email, or the in-app messaging tool.

To revoke a link (e.g., after a dispute or account closure), click **New Link**. The old URL immediately stops working and a new one is generated.

You can also find job-specific share links on the Job detail page if you want to send a link that opens directly on a particular job.

## Role and Permission Notes

- Share link generation is available to team members with access to customer and job detail records.
- Portal links are external-facing and unauthenticated — anyone with the link can view the client's data. Treat them like passwords.
- Regenerating a link is the only way to revoke access; there is no expiration date.

## Best Practices

- **Send context with the link.** A message like "Here's your estimate — click Approve when you're ready to proceed" sets expectations and reduces back-and-forth.
- **Regenerate links when clients change.** If a customer relationship ends or personnel changes on the client side, generate a new link to cut off the old one.
- **Use change orders instead of editing approved estimates.** This keeps the client informed and gives them the chance to approve changes rather than seeing numbers change silently.
- **Upload before/after photos.** Clients who can see visual proof of work completed are more likely to pay quickly and leave positive reviews.
