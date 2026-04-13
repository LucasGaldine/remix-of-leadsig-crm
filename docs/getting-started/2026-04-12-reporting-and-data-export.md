# Getting Started: Reporting & Data Export

## Overview

Reporting and export workflows turn operational records into financial and performance visibility for decision-making.

## What This Area Is For

Use this area to:

- Review key operational and revenue indicators.
- Export invoice/payment data for accounting workflows.
- Reconcile system totals with external records.
- Build repeatable weekly and monthly reporting routines.

## Core Workflow

1. Review dashboard metrics at `/`.
2. Open `/payments` and filter invoices/payments by reporting period.
3. Export relevant financial records.
4. Reconcile exported totals with collected payment records.
5. Share summarized insights and action items with role owners.

## Key Actions and Navigation

- `Dashboard analytics`: `/`
- `Payments and billing records`: `/payments`
- `Invoice and payment detail records`: `/payments/invoices/:id`, `/payments/:id`
- `Customer context for reconciliation`: `/customers/:id`

## Role and Permission Notes

- Reporting ownership usually sits with `owner` and `admin`.
- Operational teams should consume reports to improve lead, scheduling, and collection performance.

## Common Mistakes and Best Practices

- Mistake: Running exports without fixed date ranges.
- Best practice: Use standardized reporting windows (weekly/monthly).
- Mistake: Reporting from unclean operational data.
- Best practice: Enforce status hygiene in leads/jobs/invoices before reporting.
- Mistake: No reconciliation check after exports.
- Best practice: Compare exported totals to in-app payment records every cycle.
