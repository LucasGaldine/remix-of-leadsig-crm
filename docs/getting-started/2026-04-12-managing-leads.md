# Getting Started: Managing Leads

## Overview

The Leads page (`/leads`) is your pipeline. Every potential client starts here before becoming an active job. Your goal is to move each lead through a clear progression:

- Qualify the lead and convert it into a job
- Park it for follow-up if the timing is not right
- Archive or reject it when it is not a fit

A clean, up-to-date lead pipeline makes scheduling, job creation, and revenue forecasting reliable. Stale or ambiguous lead records create confusion during handoffs and make it hard to act on what actually needs attention.

---

## Lead Statuses and What They Mean

LeadSig uses four statuses to track where a lead stands. Every lead should always reflect its current real-world state, not where it started.

| Status | Meaning | What to do next |
|---|---|---|
| `New` | Just created, no outreach has happened yet | Make first contact and log what you did in notes |
| `Contacted` | Outreach has started, still gathering details | Continue follow-up; get scope, timeline, and budget info |
| `Qualified` | Good fit confirmed, ready for scheduling or estimating | Convert to a job from the lead detail page |
| `Archive` | Not actively being pursued | Keep the record for history; no further follow-up expected |

> **Common mistake:** Leaving a lead in `New` after outreach has already started. Update the status immediately after each meaningful action so teammates and the pipeline stay accurate.

---

## The Approval and Rejection Queues

Beyond the four core statuses, two additional queues handle leads that require review before moving forward:

**Pending Approval** (`/leads/pending-approval`)
Leads that have been flagged for owner or admin review before they can progress. This is used when your organization requires sign-off before committing resources to a lead (for example, large-scope jobs, unusual service requests, or leads outside your normal service area). Until approved, the lead stays in this queue rather than advancing to `Qualified`.

**Rejected** (`/leads/rejected`)
Leads that were reviewed and explicitly dismissed. Rejected leads are kept for record-keeping and can be referenced later (for example, if the same contact returns). This is distinct from `Archive`: rejected leads were actively evaluated and turned down; archived leads were simply set aside.

---

## Daily Lead Management Workflow

A consistent daily process prevents leads from going stale or falling through the cracks:

1. Open `/leads` and filter by `New` to see what came in since your last session.
2. Contact each new lead (call, email, or text) and log what happened in notes.
3. Update the status to `Contacted` immediately after first touch.
4. Gather the details you need to qualify: service type, location, scope, timeline, and budget fit.
5. Mark the lead `Qualified` once you have confirmed it is a genuine opportunity.
6. Convert the qualified lead into a job from the lead detail page (`/leads/:id`).
7. Move non-viable leads to `Archive`, or route them through the approval/rejection flow if your organization requires it.

For stale `Contacted` leads (ones where follow-up has stalled), run a weekly pass to either re-engage or move them to `Archive`. Leads sitting in `Contacted` for too long distort your pipeline and create noise.

---

## Key Actions on the Leads Page

### Create a lead

Use the floating quick-action button on any page, or navigate to `/leads` and create from there.

Minimum required fields at creation:
- Lead name (person or business)
- At least one reliable contact method (phone or email)

You can fill in additional details (service type, property address, notes, lead source) immediately or on the detail page later. The more complete the record at creation, the less follow-up is needed to qualify it.

### Find the right lead quickly

- **Search** by name, phone number, email, or other known details.
- **Filter by status** (`All`, `New`, `Contacted`, `Qualified`, `Archive`) to work in batches. Processing all `New` leads at once is more efficient than switching context repeatedly.
- **Pending Approval and Rejected** queues are accessible from `/leads/pending-approval` and `/leads/rejected` directly.

### Keep lead records usable for your team

On each lead detail page (`/leads/:id`):

- Keep contact information current. An outdated phone number or address wastes time during follow-up.
- Add a note after every meaningful interaction. Notes should include what was discussed, what was committed to, and what the next step is.
- Capture a specific next action and expected date ("Sending estimate by Friday" is more useful than "Following up soon").
- Update the status immediately. Do not wait until the end of the day.

**What makes a note useful for team handoff:** Write as if someone else will pick up the lead and needs to understand the full context without asking you. Include the channel used (call/email/text), what the client said, any specific service details mentioned, and what you promised.

**What makes a note unhelpful:** "Called, no answer." or "Sent email." These create a log but tell a teammate nothing about where the opportunity stands.

### Convert a qualified lead into a job

Once a lead is marked `Qualified`, a **Convert to Job** action becomes available on the lead detail page.

Before converting:
- Confirm the client's name, contact details, and service address. These carry over to the job and will appear on estimates and invoices.
- Confirm the service type and rough scope so the job record starts complete.

After conversion, the lead record is preserved for reference. The new job appears in `/jobs` and can be scheduled, assigned to crew, and billed from there.

> If you convert a lead with incomplete contact details, those gaps will surface on downstream job and payment records. Fixing them later is more work than getting them right before conversion.

---

## Qualification: What "Qualified" Should Actually Mean

A lead being `Qualified` should mean the same thing across your team. Without a shared definition, the status becomes meaningless and conversion rates are unreliable.

Suggested qualification criteria for service businesses:

- **Service area fit:** The property is within your geographic service zone (see `/settings/service-area`).
- **Service type fit:** The requested work matches services you offer.
- **Minimum job size:** The scope meets your minimum job threshold (see `/settings/min-job-size`).
- **Reachable contact:** You have confirmed contact information and have successfully reached the client.
- **Realistic timeline:** The client's expected start date is workable given your current schedule.

Document your team's criteria. If your qualification bar varies by role (for example, if only owners can qualify enterprise-sized jobs), that is a good candidate for the Pending Approval flow.

---

## Team Process Recommendations

- **Set a response-time standard** for new inbound leads. The faster a lead is contacted, the higher the conversion rate. Define what "new" means (under 1 hour? same business day?) and hold to it.
- **Write notes for handoff quality.** Assume a teammate will continue the lead. If your note doesn't tell them what to do next, rewrite it.
- **Review `Pending Approval` and `Rejected` queues on a fixed cadence**, daily or weekly depending on volume. Leads sitting in Pending Approval without a decision delay conversion.
- **Run a weekly cleanup pass on stale `Contacted` leads.** Any lead untouched for more than your follow-up window should either be re-engaged or archived.
- **Track where leads come from.** Use lead sources (`/settings/lead-sources`) consistently so you can identify which channels are performing. Inconsistent tagging makes the data unreliable.

---

## Common Mistakes to Avoid

| Mistake | Why it matters |
|---|---|
| Leaving leads in `New` after outreach has started | Misrepresents the pipeline; teammates don't know what has been done |
| Converting to jobs before confirming contact/service details | Gaps surface downstream on estimates and invoices |
| Writing vague notes | Teammates can't pick up where you left off without calling you |
| Archiving too early | You may prematurely close a lead that needed one more follow-up |
| Skipping the `Contacted` status and jumping straight to `Archive` | Loses the history of what was attempted |

---

## Permissions and Access

Lead management is role-based:

| Role | Lead Access |
|---|---|
| `owner` | Full access: create, edit, convert, approve, reject |
| `admin` | Full access: create, edit, convert, approve, reject |
| `sales` | Full access: create, edit, convert |
| `crew_lead` | No lead access |
| `crew_member` | No lead access |

Crew roles are focused on job execution, not pipeline management. If a crew member surfaces a new opportunity in the field, have them report it to a sales or admin user to create the lead.
