# Getting Started: Main Pages and What You Can Do on Each

## Overview

LeadSig is organized around the full service-business workflow: a lead comes in, you qualify it, schedule a job, send an estimate, do the work, then collect payment. Each page in the app maps to a stage in that workflow.

After logging in, the pages you see depend on your role:

| Role | Access Level |
|------|-------------|
| `owner` | Full access to all pages and settings |
| `admin` | Full access, same as owner minus billing controls |
| `sales` | Leads, jobs, payments, clients, and schedule |
| `crew_lead` | Schedule, jobs, and crew dashboard |
| `crew_member` | Crew dashboard only (simplified view) |

This guide walks through each main page, what it is for, and the key actions available on it.

---

## Main Navigation Pages

### Dashboard (`/`)

**What it is for**

Your daily command center. Surfaces the most important numbers and active records so you can quickly assess what needs attention without digging through individual pages.

**What you can do**

- Review high-level performance cards: active leads, jobs in progress, revenue, and open estimates.
- See trend indicators (up/down vs. prior period) at a glance.
- Open any lead, job, estimate, or payment record directly from a dashboard card.
- Use the floating quick-action button to add a new lead or create a new job without navigating away.

> **Crew members:** The `/` route redirects to the Crew Dashboard view. See [Crew Dashboard](#crew-dashboard-crew-and--for-crew-members) below.

---

### Inbox (`/inbox`)

**What it is for**

A unified activity feed across every record type in the system. Useful when you want to search or browse recent activity without knowing which specific page to look in.

**What you can do**

- Search across all record types (clients, leads, jobs, estimates, invoices, payments) from a single search bar.
- Filter the list by type: `All`, `Clients`, `Leads`, `Jobs`, `Estimates`, `Invoices`, or `Payments`.
- Sort results by newest, oldest, name, or record type.
- Click any row to jump directly to that record's detail page.

---

### Schedule (`/schedule`)

**What it is for**

Calendar-based planning workspace. Shows scheduled jobs laid out by date so you can manage workload, spot gaps, and plan crew assignments.

**What you can do**

- Toggle between **week** and **month** calendar views.
- Navigate forward and backward through date ranges.
- Click a scheduled job entry to open its detail page.
- Filter the calendar by crew member (available to roles with crew management permissions).
- Review days off and projected dates for recurring jobs.
- Create scheduled instances for jobs that repeat on a recurring basis.

---

### Leads (`/leads`)

**What it is for**

Pipeline management for incoming opportunities. Every potential client starts here as a lead before becoming an active job.

**What you can do**

- Search leads by name, contact info, or any field.
- Sort and filter by status: `All`, `New`, `Contacted`, `Qualified`, or `Archive`.
- Access the **Pending Approval** queue (`/leads/pending-approval`) for leads that require owner/admin sign-off before moving forward.
- Access the **Rejected** queue (`/leads/rejected`) to review dismissed leads.
- Open a lead detail page (`/leads/:id`) to edit contact info, add notes, update status, and send follow-ups.
- Qualify a lead and convert it into a job from the detail page.
- Add a new lead via the quick-action button.

---

### Jobs (`/jobs`)

**What it is for**

Operational hub for all scheduled and active work. Once a lead is qualified and a job is created, it lives here through scheduling, execution, and completion.

**What you can do**

- Search and sort the job list.
- Filter by operational status: `Unscheduled`, `Scheduled`, `In Progress`, or `Completed`.
- Use focused queues to find jobs that need attention:
  - **Unassigned** — jobs with no crew member assigned yet.
  - **Needs Invoice** — completed jobs without an invoice.
  - **Overdue** — jobs past their scheduled date that are not yet complete.
- Open a job detail page (`/jobs/:id`) to:
  - Schedule the job and assign crew members.
  - Add notes, photos, or checklist items.
  - Mark the job complete.
  - Generate an estimate or invoice directly from the job.
- Create a new job from the quick-action button.

---

### Payments (`/payments`)

**What it is for**

Financial operations hub covering the full billing lifecycle: estimates → invoices → collected payments.

**What you can do**

- Switch between tabs: `All`, `Estimates`, `Invoices`, and `Payments`.
- Search and sort each list independently.
- Filter invoices by aging state (e.g., overdue) and filter estimates by review status.
- Open detail pages for any estimate, invoice, or payment record.
- **Estimates** (`/payments/estimates/:id`): review line items, edit, send to the client for approval, or convert to an invoice.
- **Invoices** (`/payments/invoices/:id`): review, send, mark as paid, or charge via Stripe.
- **Payments** (`/payments/:id`): view payment details and receipts.
- Create a new estimate (`/payments/estimates/new`) or new invoice (`/payments/invoices/new`).
- Charge a payment directly via `/payments/charge`.
- Export invoice history for accounting.

---

### Clients (`/customers`)

**What it is for**

Your full customer directory. Provides a single place to find any client and see their complete history with your business.

**What you can do**

- Search clients by name, email, or phone number.
- Sort by name or by date added.
- Open a client detail page (`/customers/:id`) to view:
  - Contact information and service address.
  - All associated jobs, estimates, invoices, and payments.
  - Notes and activity history.
- Add a new lead or job for an existing client from the quick-action button.

---

### Settings (`/settings`)

**What it is for**

Configuration hub for everything account-level: your business profile, service area, pricing, automations, crew management, notifications, and billing.

**What you can do**

- Use the settings search bar to find any setting by keyword.
- Access each settings area directly:

| Settings Page | Path | What it configures |
|---------------|------|--------------------|
| Profile | `/settings/profile` | Your personal name and contact info |
| Company Profile | `/settings/company` | Business name, logo, address |
| Service Area | `/settings/service-area` | Geographic zones you serve |
| Pricing | `/settings/pricing` | Base pricing and service rates |
| Pricing Rules | `/settings/pricing-rules` | Conditional pricing logic |
| Min Job Size | `/settings/min-job-size` | Minimum job value threshold |
| Availability | `/settings/availability` | Working hours and blackout dates |
| Crew Management | `/settings/crew` | Add/remove crew, assign roles |
| Lead Sources | `/settings/lead-sources` | Track where leads come from |
| Lead Automations | `/settings/lead-automations` | Auto-assignment and follow-up rules |
| Auto Responses | `/settings/auto-responses` | Automated message templates |
| Notifications | `/settings/notifications` | Email and SMS alert preferences |
| Dashboard | `/settings/dashboard` | Customize dashboard card layout |
| Stripe | `/settings/stripe` | Connect Stripe for payments |
| Billing/Plan | `/settings/pricing` | Manage your LeadSig subscription |
| API Keys | `/settings/api-keys` | Generate API keys for integrations |

> **Note:** Stripe and billing settings are restricted to `owner` and `admin` roles. Crew management is restricted to `owner`, `admin`, and `sales`.

---

## Crew-Focused Page

### Crew Dashboard (`/crew`, and `/` for crew members)

**What it is for**

A focused, simplified view for field workers. Strips away the management overhead and surfaces only what a crew member needs to do their work.

**What you can do**

- See assigned active jobs with relevant details (address, scheduled time, notes).
- View upcoming scheduled jobs.
- See a count of completed jobs.
- Open any assigned job's detail page.
- Jump to the schedule calendar for broader date context.

---

## Role-Based Visibility Summary

| Page | owner | admin | sales | crew_lead | crew_member |
|------|-------|-------|-------|-----------|-------------|
| Dashboard | Full | Full | Full | Full | Crew view |
| Inbox | Yes | Yes | Yes | Limited | No |
| Schedule | Full | Full | Full | Full | No |
| Leads | Full | Full | Full | No | No |
| Jobs | Full | Full | Full | Limited | No |
| Payments | Full | Full | Full | No | No |
| Clients | Full | Full | Full | No | No |
| Settings | Full | Full | Partial | No | No |
| Crew Dashboard | Yes | Yes | No | Yes | Yes (default) |

Specific controls within a page (such as deleting records or managing billing) may be further restricted even when the page is accessible.
