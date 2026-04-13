# Getting Started: Account Setup, Login, and Basic Flow

## Overview

When you first open LeadSig, you land on the Auth page (`/auth`). From here you can either sign up for a new account or log in to an existing one.

There are two ways to sign up:

| Path | Who it's for |
|---|---|
| **Create a New Company** | You're starting fresh — you'll be the Owner of a new company account |
| **Join an Existing Company** | You're joining a team that's already on LeadSig |

---

## Signing Up: Create a New Company

Choose **Sign Up**, then select **Create a New Company**.

### What you'll fill in

| Field | Required? |
|---|---|
| Full name | Yes |
| Email | Yes |
| Password | Yes |
| Company name | Yes |
| Company phone | No |
| Company address | No |

### What happens after you submit

1. Your account is created with the **Owner** role — the highest permission level.
2. You're taken directly into the **onboarding flow**, which has two steps:
   - **Step 1 — Previous CRM:** Select where you're coming from (e.g., spreadsheets, another CRM, or starting fresh).
   - **Step 2 — Data Import:** Optionally import your existing leads, clients, and jobs from a CSV file.
3. After onboarding, you're taken to the **tutorial** (`/tutorial`) for a guided walkthrough of the main pages.

### How CSV import works

During Step 2, if you choose to import data, LeadSig walks you through mapping your CSV columns to its fields:

- LeadSig makes an automatic first pass, matching common header names where it can.
- You can manually change any mapping that doesn't look right.
- You can skip columns you don't need.
- Some fields are required: `Name` for leads and clients, `Customer Name` for jobs.
- You can combine multiple columns into one field — for example, mapping both `First Name` and `Last Name` to the Name field. LeadSig will merge them.
- For lead imports: if you map a status column, LeadSig will also ask you to map each of your source statuses to the corresponding LeadSig status.

---

## Signing Up: Join an Existing Company

Choose **Sign Up**, then select **Join Existing Company**.

### What you'll fill in

| Field | Required? |
|---|---|
| Full name | Yes |
| Email | Yes |
| Password | Yes |
| Company code | Yes |
| Role | Yes |

### Getting the company code

You'll need a code from someone who already manages the company. Owners and admins can find it in:

**Settings → Crew Management** (`/settings/crew`) → **Invite New Members** card

### Choosing your role

When joining, you can pick one of three roles:

| Role | What it's for |
|---|---|
| **Sales** | Pipeline and customer-facing work — leads, customers, jobs |
| **Crew Lead** | Field and operations lead; included in manager-level crew logic |
| **Crew Member** | Execution-focused; defaults to a crew dashboard showing only assigned work |

> **Note:** You cannot select **Admin** when signing up. Admin access is granted after the fact by an existing Owner or Admin from the team management settings.

---

## Logging In

Once your account is created, you always log in from the same Auth page (`/auth`) using your email and password. There's no separate login URL for owners vs. team members.
