# Getting Started: Settings - Dashboard Preferences

## Overview

Dashboard Preferences let you control exactly what appears when you open the app. You can choose which stat cards sit at the top of the dashboard, what order they appear in, and which content sections are shown below them. Changes save per-account and persist across sessions.

Navigate to **Settings → Dashboard Layout** (`/settings/dashboard`) to configure.

---

## The Two Configuration Areas

### 1. Stat Cards (Top of Dashboard)

Stat cards are the numbered summary tiles at the top of your dashboard. Each card links directly to its relevant page so you can act on the number immediately.

**Rules:**
- Minimum 1 card, maximum 4 cards active at a time.
- Cards are ordered — drag to reorder them using the grip handle on the left.
- The order you set here is the order they appear on the dashboard.

**Available stat cards:**

| Card | What It Shows | Links To |
|---|---|---|
| Leads Pending | Leads awaiting your internal approval | `/leads/pending-approval` |
| Pending Approvals | Estimates sent and waiting for client sign-off | `/payments` |
| Qualified Leads | Approved leads ready to be converted to jobs | `/leads` |
| Active Jobs | Jobs currently in progress | `/jobs` |
| Today's Jobs | Jobs scheduled for today | `/schedule` |
| Total Jobs | All jobs regardless of status | `/jobs` |
| Revenue This Month | Total revenue collected in the current month | `/payments` |
| Outstanding Invoices | Unpaid invoices that need follow-up | `/payments` |
| Total Leads | All leads across all stages | `/leads` |
| Completed Jobs | Jobs finished but not yet invoiced | `/jobs` |
| Paid Jobs | Jobs that have a recorded payment | `/jobs` |
| Unassigned Jobs | Scheduled jobs with no crew member assigned | `/jobs` |
| Overdue Jobs | Jobs past their last scheduled date | `/jobs` |
| Estimates to Review | Estimate visits completed, pending your review | `/payments` |

**Default cards on a new account:** Leads Pending, Pending Approvals, Qualified Leads.

---

### 2. Dashboard Sections (Below the Stat Cards)

Sections are the list-based panels that appear below the stat cards. Each section can be toggled on or off independently using the switch on the right.

**Available sections:**

| Section | What It Shows |
|---|---|
| Awaiting Approval | Estimates sent to clients that haven't been approved yet |
| Today's Jobs | A list of all jobs scheduled for today |
| Qualified Leads | Leads that have passed approval and are ready to convert |
| Clients | Your most recent clients |

**Default sections on a new account:** All four are enabled.

---

## Core Workflow

1. Go to `/settings/dashboard`.
2. **Cards panel:** Remove cards you don't need by clicking the X. Add cards from the "Available Cards" list below. Drag to reorder.
3. **Sections panel:** Toggle sections on or off with the switch.
4. Click **Save layout** in the sticky action bar at the bottom.
5. Navigate to `/` to see your changes take effect.
6. If you navigate away with unsaved changes, a dialog will prompt you to save or discard.

---

## Role and Permission Notes

- Any user with access to `/settings/dashboard` can configure their own layout.
- `owner` and `admin` roles typically set the initial layout to match operational priorities for the team.
- Changes are per-user — one person's configuration does not affect others.
- Cards that link to restricted pages (e.g., `/payments`) are still visible on the dashboard regardless of role, but the destination page will enforce its own access rules.

---

## Choosing the Right Cards for Your Role

**Owner / Admin**
Focus on financial visibility and pipeline health. Recommended: Revenue This Month, Outstanding Invoices, Leads Pending, Pending Approvals.

**Sales**
Focus on lead conversion. Recommended: Leads Pending, Qualified Leads, Pending Approvals, Estimates to Review.

**Operations / Dispatch**
Focus on job execution. Recommended: Today's Jobs, Active Jobs, Unassigned Jobs, Overdue Jobs.

---

## Common Mistakes and Best Practices

- **Mistake:** Selecting all 4 cards without thinking about daily workflow.
  **Best practice:** Only include cards where the number on screen should trigger an action from you that day.

- **Mistake:** Leaving the default configuration unchanged after onboarding.
  **Best practice:** After your first week, review which cards you actually clicked. Remove the ones you ignored.

- **Mistake:** Disabling all sections to keep the dashboard minimal.
  **Best practice:** Keep at least Today's Jobs or Qualified Leads enabled — they serve as action queues, not just summaries.

- **Mistake:** Treating stat cards as reporting.
  **Best practice:** Every card taps through to a filtered list where you take action. If you're not clicking through, the card isn't earning its slot.

- **Mistake:** Never revisiting configuration.
  **Best practice:** Recalibrate when your team grows, your workflow changes, or a new service type is introduced.
