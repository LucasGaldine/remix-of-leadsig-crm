# Roles, Permissions & Team Workflows

## Overview

Roles control what each team member can see and do. Workflows define how work moves between roles — from capturing a lead all the way to collecting payment.

## When to Use This Guide

- You're onboarding a new team member and need to assign the right role.
- You want to restrict access to billing or account settings.
- You're standardizing how work is handed off between sales, operations, and finance.
- You're auditing who has access to what after a team change.

## Roles at a Glance

| Role | What They Can Do |
|---|---|
| `owner` | Full access, including billing and account-level settings |
| `admin` | Broad operational access; typically excludes ownership-only controls |
| `sales` | Manage leads, customers, and estimates |
| `crew_lead` | Oversee job execution; limited to operational views |
| `crew_member` | View and complete assigned jobs |

## Where to Manage Roles

- **Team membership & role assignment** → `/settings/crew`
- **Lead and sales pipeline** → `/leads`
- **Job execution and scheduling** → `/jobs` and `/schedule`
- **Billing and payments** → `/payments` and `/settings/stripe`
- **Crew operational view** → `/crew`

## Setup Steps

1. Define what each role is responsible for in your organization.
2. Map the lead → job → invoice → payment workflow to specific role owners.
3. Assign roles to team members at `/settings/crew`.
4. Test that each role sees only what they should in the live app.
5. Revisit permissions when onboarding, promoting, or offboarding team members.

## Common Mistakes

**Not assigning a workflow owner**
Every critical stage (lead intake, job scheduling, invoicing) should have a clear role responsible for it.

**Permission drift**
Roles accumulate access over time as people change jobs. Run periodic audits to keep permissions accurate.

**Informal approvals**
Decisions made in chat or verbally are hard to track. Record approvals in-system where possible.
