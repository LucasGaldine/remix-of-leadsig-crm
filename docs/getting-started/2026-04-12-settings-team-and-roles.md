# Getting Started: Settings - Team & Roles

## Overview

Team and role settings control who can access LeadSig, what each person can do, and how work ownership is distributed. This page covers both **signed team members** (people with accounts) and **mock crew profiles** (placeholder entries for crew who haven't signed up yet).

Navigate to this area at `/settings/crew`.

---

## How Invitations Work

LeadSig uses a **company invite code** rather than email-based invitations. There is no "send invite" button — instead, you share a code and new members join themselves.

**The flow:**
1. Go to `/settings/crew` and copy your company invite code.
2. Share the code with your new team member (text, email, Slack — any channel works).
3. They create a LeadSig account at the signup page.
4. During signup, they enter the invite code and select their role.
5. Access is granted immediately — no approval step required.

**Important:** The role selected at signup is what they start with. An `owner` or `admin` can change it afterward from the same page.

---

## Role Reference

There are five roles, ordered by access level:

| Role | Access Level | Typical Use |
|---|---|---|
| `owner` | Full access including billing and account-level settings | Founder, primary account holder |
| `admin` | Broad operational access; excludes ownership-only controls | Office manager, operations lead |
| `sales` | Manage leads, customers, and estimates | Sales rep, estimator |
| `crew_lead` | Operational views; can manage crew execution | Foreman, lead technician |
| `crew_member` | View and complete only their assigned jobs | Field technician, crew worker |

### Permission Groups Used in the App

The app groups roles into three logical permission checks:

- **Owner or Admin** (`owner` or `admin`) — Can invite, remove, and edit team members. Can access all settings.
- **Manager** (`owner`, `admin`, or `crew_lead`) — Can oversee job execution and crew assignment.
- **Crew Member** (`crew_member` only) — Restricted to the `/crew` dashboard with their assigned job view.

### What Only an `owner` Can Do

Role changes are restricted to `owner` only. An `admin` can edit a member's description but **cannot change their role**. Only `owner` accounts see the role dropdown when editing a team member.

Removing a member's `owner` role triggers a warning prompt in the edit dialog before confirming.

---

## Managing Signed Team Members

Signed members are people with real LeadSig accounts who have joined your company using the invite code. They appear in the **Signed Team Members** table.

### What You Can See Per Member
- Full name
- Email address
- Phone number
- Description (a short freeform note about their specialty or function)
- Role (shown as a color-coded badge)
- Date they joined

### Editing a Member

Any `owner` or `admin` can open the edit dialog for any other member (you cannot edit your own entry from this view). From there:

- **`owner` only:** Change the member's role using the role selector.
- **`owner` or `admin`:** Update the member's short description (e.g., "Handles shrub shaping and detail finishing").

Descriptions are optional but useful when assigning crew to jobs — they appear in crew assignment views so dispatchers know who is best suited for a task.

### Removing a Member

Any authenticated team member can remove another member, with two restrictions:
- You cannot remove yourself.
- You cannot remove an `owner`.

Removing a member immediately revokes their access to all company data. This action requires confirmation via a dialog prompt. There is no "deactivate" toggle — removal is the only off-boarding option.

---

## Mock Crew Profiles

Mock crew profiles are placeholder entries for crew members who haven't created a LeadSig account yet. They exist so you can **assign unsigned workers to jobs right now** without waiting for them to sign up.

### When to Use Them

- You have seasonal or contract workers who may never create accounts.
- You're setting up a schedule before your team has fully onboarded.
- You want to pre-assign a role and description to a worker for dispatch planning.

### What a Mock Profile Includes

- **Name** (required) — e.g., "Alex - Seasonal Crew"
- **Phone** (optional) — for your reference
- **Description** (optional) — specialty or function note
- **Role** — limited to `crew_lead` or `crew_member` only (mock profiles cannot hold elevated roles)

### Limitations

- Mock profiles have no login access — they are purely for scheduling and dispatch.
- They appear in team/crew selectors alongside signed members when assigning jobs.
- **Removing a mock profile also removes any existing job assignments tied to it.** The confirmation dialog makes this explicit.

### Converting a Mock Profile to a Real Member

There is no automatic merge. Once the real person creates an account and joins with the invite code, you can manually remove the mock profile and update any past job records if needed.

---

## Access Control Summary

| Action | Owner | Admin | Sales | Crew Lead | Crew Member |
|---|:---:|:---:|:---:|:---:|:---:|
| View team members | ✓ | ✓ | ✓ | ✓ | ✓ |
| Copy invite code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit member description | ✓ | ✓ | — | — | — |
| Change member role | ✓ | — | — | — | — |
| Remove a member | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage mock profiles | ✓ | ✓ | ✓ | ✓ | ✓ |

> Removing members or mock profiles is available to all roles per the data model, but in practice this should be an `owner` or `admin` action. Define this expectation in your internal SOPs.

---

## Common Mistakes and Best Practices

**Mistake:** Granting elevated roles for convenience (e.g., making everyone an `admin` to avoid permission questions).  
**Best practice:** Apply least-privilege by default. Elevate only when a role genuinely needs the access.

**Mistake:** Leaving former team members active after they leave.  
**Best practice:** Remove access on the day of offboarding. There is no suspension state — removal is immediate and complete.

**Mistake:** Skipping mock profiles and not assigning unsigned crew to jobs.  
**Best practice:** Create mock profiles for any worker you're scheduling before they sign up. Remove them once the real account is set up.

**Mistake:** Not filling in descriptions for crew members.  
**Best practice:** Add a short description for each crew member. It surfaces in job assignment views and helps dispatchers match the right person to the right task.

**Mistake:** Changing an owner's role without a handoff plan.  
**Best practice:** Ensure at least one `owner` account is always active. Demoting the only owner removes billing and account-level access from your team.

---

## Related Pages

- [Roles, Permissions & Team Workflows](./2026-04-12-roles-permissions-and-team-workflows.md) — Detailed breakdown of how roles map to workflows across the app.
- [Jobs & Scheduling](./2026-04-12-jobs-and-scheduling.md) — Where mock and signed crew profiles appear for assignment.
