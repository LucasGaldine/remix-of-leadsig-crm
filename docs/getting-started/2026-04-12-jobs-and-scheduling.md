# Getting Started: Jobs & Scheduling

## Overview

Jobs are the core work records in LeadSig. Each job tracks a piece of field work from creation through crew assignment, scheduling, execution, and billing. The scheduling system lets you place one or multiple visits on the calendar, assign specific crew members to each date, and spot conflicts before they happen.

## Job Statuses

A job moves through these statuses as it progresses:

| Status | Meaning |
|---|---|
| **Unscheduled** | Job exists but has no dates added yet |
| **Unassigned** | A date has been added but no crew is assigned to it |
| **Scheduled** | Date added and crew assigned — ready to execute |
| **In Progress** | Work is actively underway |
| **Completed** | Field work is done, pending billing |
| **Needs Invoice** | Completed but no invoice has been created |
| **Paid** | Invoice created and payment recorded |

The jobs list highlights three actionable alert badges at the top when they apply:

- **Unassigned** — jobs with a scheduled date but no crew assigned
- **Needs Invoice** — completed jobs without an invoice
- **Overdue** — jobs whose last scheduled date has passed and aren't completed

Clicking any alert badge filters the list to those jobs.

## Navigating Jobs

- **Jobs list** (`/jobs`): searchable, sortable list with status filter tabs. Sort by newest, oldest, scheduled soonest/latest, or name.
- **Job detail** (`/jobs/:id`): full record for a single job — scope, customer, schedule, crew, checklist, photos, notes, costs, and invoice.
- **Schedule view** (`/schedule`): calendar workspace showing all jobs in week or month view.

## Creating a Job

Jobs can be created from:

- The floating action button on the jobs list
- A lead or estimate context (converts approved work to an active job)
- CSV import via the import modal

When creating, you provide the job name, service type, customer, and service address. Scope details and notes can be added before or after scheduling.

## Scheduling a Job

From the job detail page, click **Add Schedule**. The scheduling dialog has two steps:

1. **Pick dates and times** — add one or more visit dates with optional start/end times. To set up a repeating job instead, switch to the **Recurring** tab.
2. **Assign crew** — select crew members for each date. The system checks for scheduling conflicts in real time and flags any crew member already booked for an overlapping time slot on the same date. Conflicted members are shown but cannot be selected.

To change or remove a scheduled visit later, use **Edit Schedule** from the job detail.

## Recurring Jobs

To make a job repeat automatically, either:

- Choose the **Recurring** tab during initial scheduling, or
- Open the job detail and select **Make Recurring**

Recurring options:

- **Frequency**: Weekly, Every 2 Weeks, or Monthly
- **Days of week**: select which days the job should run
- **Start and end date**: set when the series begins and optionally when it ends
- **Time window**: carry over start/end times from the original schedule

Recurring job instances appear on the schedule individually and can be managed from the recurring job detail modal.

## Time Tracking

Each job detail includes a **Time Tracker** for crew clock-in/out. Time tracking supports:

- Manual clock in/out with a running elapsed timer
- Geofence-based auto clock-in/out when crew arrives at or leaves the job address (requires location permission)
- A full entry log showing each session's duration and notes

## Job Detail Sections

| Tab | What it contains |
|---|---|
| **Details** | Customer info, address, service type, assigned estimate, schedule entries, costs |
| **Checklist** | Step-by-step completion checklist items |
| **Photos** | Before/after and progress photos |
| **Notes** | Internal notes with @mention support for team members |

## Completing a Job

When field work is done, mark the job **Complete** from the job detail. If a checklist or photos are required, complete those before transitioning status. After completion, the job surfaces in the **Needs Invoice** alert filter until an invoice is generated.

## Handing Off to Billing

From a completed job detail, use **Create Invoice** to generate an invoice directly tied to the job. See [Invoices & Payments](./2026-04-12-invoices-and-payments.md) for the full billing workflow.

## Client Portal

Each job has a shareable client portal link that gives the customer a read-only view of their job status and details. Generate the link from the job detail using the **Share** action.

## Role and Permission Notes

- `owner`, `admin`, and `sales` can create jobs, manage scheduling, assign crew, and view all jobs.
- `crew_lead` can view their assigned jobs, update status, and log time.
- `crew_member` works primarily from `/crew` and sees only their own assigned jobs.

## Common Mistakes and Best Practices

- **Scheduling before confirming address**: The time tracker and geofence rely on the service address. Set it before scheduling.
- **Leaving jobs unassigned**: Use the Unassigned alert badge as a daily review. An unassigned job on the schedule means nobody knows they're responsible.
- **Completing before checklist is done**: Enforce photo and checklist requirements before marking complete to avoid re-opening jobs.
- **Forgetting to invoice**: The Needs Invoice badge catches completed jobs without invoices, but check it regularly — completed jobs don't generate invoices automatically.
