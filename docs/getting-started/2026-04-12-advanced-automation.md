# Getting Started: Advanced Automation

## Overview

LeadSig's automation layer connects lead intake, messaging, scheduling, and notifications so that routine coordination happens without manual intervention. This doc explains the automation surfaces available, how they fit together, and how to roll them out safely.

## Automation Surfaces in LeadSig

LeadSig has three distinct automation surfaces. Each operates independently, but they work best when configured as a coordinated system.

### 1. Auto Responses (`/settings/auto-responses`)

Sends a pre-written message automatically when a lead is created or reaches a defined stage. Designed for first-touch acknowledgment and follow-up prompts.

- Triggered by lead creation events or status changes.
- Supports variable substitution (for example customer name, service type).
- Delivered via the messaging system — the same thread the lead can reply to.

### 2. Lead Automations (`/settings/lead-automations`)

Applies rule-based actions when leads match defined conditions. More flexible than auto responses — can reassign leads, change status, trigger notifications, or chain into other actions.

- Trigger: a lead event (created, status changed, assigned, unresponsive after N days).
- Condition: optional filter (for example service type = "Landscaping", lead source = "Website").
- Action: reassign, update status, send message, notify team member.

### 3. Notifications (`/settings/notifications`)

Controls which internal events generate alerts and who receives them. Keeps the team informed without requiring manual status checks.

- Configurable per role — owners, admins, sales, and crew can have different alert sets.
- Covers lead activity, job updates, estimate views, invoice payments, and crew assignments.
- Notifications appear in-app and optionally by email.

## How the Three Surfaces Work Together

A well-configured automation chain looks like this:

1. **Lead arrives** → Auto response sends immediate acknowledgment to the lead.
2. **Lead automation fires** → Lead is assigned to the right sales rep based on service type or source.
3. **Notification triggers** → Assigned rep receives an alert to follow up within the configured SLA.
4. **Follow-up automation fires** (if no response in 48 hours) → Another message is sent to the lead and the manager is notified.

Each surface handles one layer. Avoid trying to do all three jobs in one rule — keep auto responses for outbound messaging, lead automations for routing and status logic, and notifications for internal visibility.

## Core Setup Workflow

1. **Standardize the manual process first.** Map out what your team currently does by hand for a high-volume workflow (for example new lead follow-up). Automate only once the manual steps are stable and agreed upon.
2. **Configure auto responses** at `/settings/auto-responses`. Write templates that include a clear next step and a way for the lead to respond or self-schedule.
3. **Define lead automation rules** at `/settings/lead-automations`. Start with one rule (for example assign all "Website" leads to a specific rep). Validate it with a test lead before adding more rules.
4. **Review notification settings** at `/settings/notifications`. Confirm that the right roles are alerted for the events that matter — avoid alerting everyone on everything.
5. **Run an end-to-end test.** Create a controlled test lead and trace it through each automation stage. Confirm the message was sent, the assignment was applied, and the right people were notified.
6. **Roll out gradually.** Enable one automation at a time. Monitor outcomes before stacking additional rules.

## Key Navigation

| Surface | Path |
|---|---|
| Auto Responses | `/settings/auto-responses` |
| Lead Automations | `/settings/lead-automations` |
| Notifications | `/settings/notifications` |
| Integration triggers | [Integrations & API Keys](./2026-04-12-integrations-and-api-keys.md) |
| Messaging context | [Messaging](./2026-04-12-messaging.md) |
| Lead execution view | `/leads` and `/leads/:id` |

## Role and Permission Notes

- `owner` and `admin` should own automation architecture — writing, enabling, and disabling rules.
- `sales` and `crew_lead` should report on automation quality (for example whether auto responses feel appropriate, whether assignments are routing correctly) without editing the rules directly.
- Each automation rule should have a named owner responsible for reviewing its behavior and disabling it if it misfires.

## Common Mistakes and Best Practices

**Activating too many rules at once**
Start with one automation, validate it, then add the next. Stacked rules interact in unexpected ways and become hard to debug.

**Generic message templates**
Every auto response should tell the lead what happens next and how to reach a human. A message that says only "Thanks for your inquiry" does not move the conversation forward.

**No disable path**
Every active automation should be documented and have a clear owner who can turn it off within minutes if it misfires. Keep a shared record of what is active and who owns it.

**No suppression logic**
If a lead automation fires on every status change, a lead that moves through multiple stages quickly can receive multiple messages in minutes. Add conditions or cooldown logic to prevent duplicate outreach.

**Automating an undefined process**
If your team doesn't agree on how something should work manually, automating it locks in the wrong behavior. Align the team first.

**Skipping failure visibility**
Define what a failed or unexpected automation outcome looks like, and establish a regular review cadence (for example weekly check of automation logs or lead notes to spot misfires).
