# Getting Started: Settings - Service Area & Availability

## Overview

Service area and availability settings control where you operate and when your team can be scheduled. Together they define your operational boundaries — the geographic zones you cover, the hours you're open, and the dates you won't take work. LeadSig uses these constraints passively during lead qualification and job scheduling.

---

## Service Area (`/settings/service-area`)

### What It Does

Service area settings let you define one or more coverage **zones**. Each zone is a named location (e.g., a city or neighborhood) paired with a travel radius in miles. You can maintain multiple zones — useful if your business operates from more than one hub or serves distinct regions.

### Key Fields

| Field | Description |
|---|---|
| **Location / City** | A human-readable label like "Austin, TX" or "Round Rock, TX". This is for your reference; it does not auto-geocode. |
| **Radius (miles)** | How far from that location you're willing to travel. Enter `0` if you want to flag a zone without enforcing a distance. |

### How to Manage Zones

**Adding a zone:**
1. Go to `/settings/service-area`.
2. In the "Add a zone" card, enter a location name and radius.
3. Click **Add** — the zone saves immediately.

**Editing a zone:**
1. Click **Edit** next to any existing zone.
2. Modify the location name or radius.
3. Click **Save** to persist. Click **Cancel** to discard.

**Removing a zone:**
- Click the trash icon next to any zone. The deletion saves immediately — there is no undo.

### How Service Areas Are Used

Service areas are informational context within LeadSig. They help you:
- Quickly assess whether an incoming lead falls within your operational footprint.
- Communicate coverage boundaries to sales and dispatching staff.
- Set expectations during the lead qualification process before converting to a job.

> **Note:** Service areas do not currently enforce a hard block on job creation. They provide context, not a gate. Discipline in your workflow matters.

---

## Availability Settings (`/settings/availability`)

### What It Does

Availability settings define three scheduling constraints:

1. **Daily Job Limit** — the maximum number of jobs you can accept on any single day.
2. **Regular Business Hours** — your working windows per day of the week.
3. **Days Off & Holidays** — specific calendar dates when no jobs can be scheduled.

### Daily Job Limit

Set a cap on how many jobs are created per day. This prevents overbooking when multiple team members or channels are creating jobs simultaneously.

- Navigate to `/settings/availability`.
- Enter a number in the **Maximum Jobs Per Day** field.
- Click **Save**.

Leave this blank if you don't want to enforce a daily cap.

### Regular Business Hours

Configure open/closed status and time windows for each day of the week (Sunday through Saturday).

**For each day you can:**
- Toggle the **Open/Closed** switch. When closed, no start/end times are shown.
- Set a **start time** and **end time** using the time picker inputs.

Changes save immediately per day — there is no global save button for business hours.

> **Note:** Jobs can still be scheduled outside your configured hours, but they will be marked as "outside normal business hours." This serves as a visibility flag, not a hard block.

**Recommended defaults for a typical 5-day operation:**
- Monday–Friday: 08:00–17:00, Open
- Saturday–Sunday: Closed

### Days Off & Holidays

Block specific calendar dates to prevent job scheduling entirely on those days. Unlike business hours, days off are a hard block — jobs **cannot** be scheduled on blocked dates.

**Adding a day off:**
1. Pick a date using the date picker (today or any future date).
2. Optionally enter a reason (e.g., "Thanksgiving", "Team Retreat").
3. Click **Add**.

**Removing a day off:**
- Click the trash icon next to the entry.
- Confirm removal in the dialog. Removing a day off immediately re-opens that date for scheduling.

---

## Core Workflow

1. Open `/settings/service-area` — define your hub locations and travel radii.
2. Open `/settings/availability` — set your daily job limit.
3. Configure business hours for each day of the week.
4. Block upcoming holidays and known days off.
5. Re-visit before major schedule changes (seasonal hours, team expansion, new coverage areas).

---

## Key Navigation

| Destination | Path |
|---|---|
| Service Area Settings | `/settings/service-area` |
| Availability Settings | `/settings/availability` |
| Schedule (where constraints surface) | `/schedule` |
| Jobs (job creation context) | [Jobs & Scheduling](./2026-04-12-jobs-and-scheduling.md) |
| Lead qualification context | [Managing Leads](./2026-04-12-managing-leads.md) |

---

## Role and Permission Notes

- `owner` and `admin` roles should own these settings. Changes here affect every user and every job created.
- `sales` and `crew_lead` roles should understand the constraints but should not override them without approval from an admin.
- If a dispatching user needs to schedule outside normal hours, they should confirm with an admin before bypassing the warning flag.

---

## Common Mistakes and Best Practices

**Service Area**
- **Mistake:** Expanding coverage without corresponding crew or schedule capacity.
- **Best practice:** Before adding a new zone, confirm you have available staff and time slots to serve it.
- **Mistake:** Using vague location labels ("North Area") that mean different things to different team members.
- **Best practice:** Use specific city or zip-level labels so all team members interpret zones consistently.

**Availability**
- **Mistake:** Setting business hours once and never revisiting them after seasonal changes.
- **Best practice:** Review availability settings at the start of each season, before major holidays, and whenever staffing changes.
- **Mistake:** Treating the "outside normal business hours" flag as ignorable noise.
- **Best practice:** Treat that flag as a real signal — confirm with the customer before scheduling outside normal windows.
- **Mistake:** Forgetting to block company holidays, resulting in jobs scheduled on days no one is working.
- **Best practice:** At the start of each year, pre-load all known company holidays as days off.
- **Mistake:** Setting a daily job limit too high and relying on it as the only capacity safeguard.
- **Best practice:** Combine the daily job limit with realistic business hours to create layered capacity control.
