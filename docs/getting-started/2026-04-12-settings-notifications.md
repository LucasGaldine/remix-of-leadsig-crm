# Getting Started: Settings - Notifications

## Overview

The Notifications settings page (`/settings/notifications`) controls how and when LeadSig reaches each team member — across SMS, email, and (soon) push. Every preference is stored per user, so each team member configures their own alert behavior independently without affecting anyone else.

> **Plan requirement:** Notification settings are available on the Basic plan and above. Users on a lower plan will see an upgrade prompt.

---

## Page Structure

The page is divided into five sections:

1. **SMS Consent** — opt-in/out of SMS messages (required before SMS can be used)
2. **Channels** — enable or disable each delivery method
3. **SMS Alerts** — choose which events trigger notifications and to which channels
4. **Quiet Hours** — silence push and SMS during off-hours
5. **Digest & Escalation** — email summary schedule and per-event email toggles (owners/admins/sales only)

A **Recent SMS Activity** card appears at the bottom when the SMS channel is enabled, showing the last few messages sent.

---

## Section 1: SMS Consent

Before SMS can be enabled as a channel, the user must explicitly opt in. This is a legal requirement — consent data is recorded with a timestamp and source.

| Action | Effect |
|---|---|
| Check **"I agree to receive SMS messages from LeadSig"** | Sets consent status to `opted_in`. Unlocks the SMS channel toggle. |
| Uncheck the box | Sets consent to `opted_out`. The SMS channel is automatically disabled and cannot be re-enabled until consent is re-granted. |

**What is recorded when you opt in:**
- Consent status (`opted_in`)
- Timestamp of when consent was captured
- Source (`profile_settings`)
- Consent text version (to track which legal language was shown)

> SMS opt-in data is never sold or shared with third parties for marketing purposes.

**Save your preferences** after changing consent status — it does not persist until you click Save.

---

## Section 2: Channels

Channels control the delivery method for alert notifications. Three channels are available:

| Channel | Status | Requirement |
|---|---|---|
| **Push** | Coming soon | No action needed |
| **Email** | Available | A valid email address must be on your profile |
| **SMS** | Available | A phone number must be on your profile, and SMS consent must be opted in |

Each channel has an on/off toggle. Toggling a channel only affects your own profile. If a channel's requirement isn't met, the toggle is disabled and a hint is shown explaining what's needed.

**Test buttons:**

- **Send test SMS** — fires a test notification to the phone number on your profile. Requires: SMS channel enabled, a phone number on your profile, and no unsaved changes. The test uses a sample "new lead" payload (or "job assignment" if you are a crew member).
- **Send test email** — fires a test digest email to your profile email. Requires: Email channel enabled, an email address on your profile, digest frequency set to Daily or Weekly, and no unsaved changes.

> Save your preferences before using test buttons — both buttons are disabled while you have unsaved changes.

---

## Section 3: SMS Alerts

This section controls which events generate notifications. It also includes **@mention notifications**, which fire when any team member types `@yourname` in a note on a lead or job.

### Alert events by role

The alerts shown depend on your role:

**Owners, admins, and sales:**

| Alert | What triggers it |
|---|---|
| **New leads** | A new lead arrives in your account |
| **Lead status changes** | A lead moves to a new stage or gets reassigned |
| **Payments & invoices** | A payment is logged, a charge fails, or an invoice goes overdue |
| **Schedule changes** | A job is rescheduled, cancelled, or its time is updated |
| **Tasks & reminders** | A daily to-do or follow-up reminder is due |

**Crew members (crew_lead / crew_member):**

| Alert | What triggers it |
|---|---|
| **Job assignments** | You are assigned to or removed from a job |
| **Schedule changes** | A job on your schedule is rescheduled or cancelled |
| **Same-day reminders** | A morning notification listing your jobs for the day |
| **Tasks & reminders** | A task or follow-up reminder assigned to you |

### @Mention notifications

Available to all roles. When enabled, you receive a notification any time someone types `@yourname` in a note on any lead or job record you have access to. This toggle is independent of the alert list above.

### Default alert states

| Role | Defaults on |
|---|---|
| Owner / admin / sales | New leads, Payments & invoices, Schedule changes |
| Crew member | Job assignments, Schedule changes, Same-day reminders, Tasks |

Use the **Reset to defaults** button (top-right of this card) to restore these defaults at any time.

---

## Section 4: Quiet Hours

Quiet hours let you pause push and SMS alerts during off-hours. Alerts generated during the quiet window are held and delivered once quiet hours end.

> **Exception:** Urgent payment failure alerts are still delivered by email even when quiet hours are active.

| Setting | Description |
|---|---|
| **Enable quiet hours** toggle | Master switch. Must be on for start/end times to take effect. |
| **Start time** | The time of day when quiet mode begins (e.g., `21:00`). |
| **End time** | The time of day when quiet mode ends and held alerts are released (e.g., `07:00`). |

Times use 24-hour format. A start time of `21:00` and end time of `07:00` means quiet mode runs from 9 PM to 7 AM.

---

## Section 5: Digest & Escalation (Owners / Admins / Sales only)

Crew members do not see this section.

### Email digest

Instead of receiving individual alerts, you can receive a single summary email on a schedule:

| Option | When it sends |
|---|---|
| **Off** | No digest email. |
| **Daily** | Every day at 8:00 AM. Includes new leads, payments, and schedule changes. |
| **Weekly** | Every Monday. Same content as daily but covering the full prior week. |

The digest is sent to the email address on your profile. Use the **Send test email** button in the Channels section to preview it.

> The test email button is disabled when digest is set to **Off**.

### Email event alerts

These three toggles send an individual email to the client when specific payment milestones occur. They are all on by default.

| Toggle | When it fires |
|---|---|
| **Estimate approved** | A client's estimate transitions to approved status |
| **Invoice sent** | An invoice is sent to the client |
| **Payment logged** | Any payment is recorded against the client's account |

> These are outbound emails to the **client**, not to you. They are distinct from the digest, which is sent to the team member's own email.

---

## Recent SMS Activity

When the SMS channel is enabled, a card at the bottom of the page shows the last 5 SMS notifications sent from your account. Each entry shows:

- Event type (e.g., "New lead", "Schedule change")
- Message body preview
- Delivery status (sent / failed)
- Error message, if the send failed
- How long ago it was sent

This is useful for confirming that test SMS messages were delivered and for diagnosing delivery failures.

---

## Saving and Resetting

- Changes to any section are **not persisted until you click Save preferences** (sticky bar at the bottom of the page).
- If you navigate away with unsaved changes, a dialog asks whether to save or discard them.
- The **Reset to defaults** button on the SMS Alerts card resets only the alert toggles to the role-appropriate defaults. It does not reset channels, quiet hours, or digest settings.

---

## Role and Permission Notes

- Each user configures their own notification preferences independently.
- `owner` and `admin` can set a standard starting posture and communicate it to the team, but cannot enforce preferences on other users.
- `crew_lead` and `crew_member` only see job-relevant alerts (no lead or payment alerts).
- SMS consent is per-user and required before SMS can be activated — it cannot be granted on behalf of another user.

---

## Common Mistakes and Best Practices

| Mistake | Best Practice |
|---|---|
| Enabling all alert types at once | Start with the defaults and disable only what proves to be noise after a week of use. |
| Opting into SMS without a phone number on your profile | Add a phone number to your profile first (`/settings/profile`), then return here to enable SMS. |
| Sending a test while you have unsaved changes | Click **Save preferences** first — the test buttons are blocked until changes are saved. |
| Setting the email digest to Daily but leaving the Email channel off | The digest requires the Email channel to be enabled. Turn on the Email channel and save before testing. |
| Forgetting to configure quiet hours when managing a business with evening hours | Set quiet hours to match your personal off-hours (e.g., 10 PM – 7 AM) so you are not paged after hours. |
| Leaving all three client email event toggles on without verifying opt-in flows | Confirm clients expect transactional emails before leaving Estimate approved, Invoice sent, and Payment logged all active. |
| Not rotating notification settings after a role change | When a crew member is promoted to admin, they should revisit this page — the visible alert types change and defaults differ. |
