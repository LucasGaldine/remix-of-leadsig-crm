# Getting Started: Settings - Auto Messaging & Lead Automations

## Overview

These two settings pages control automated outbound messaging to clients and inbound webhook integrations for external tools (bots, call centers, dialers). Together they replace manual follow-up with rules-driven communication tied to job lifecycle events.

- **Auto Messaging** (`/settings/auto-responses`) — requires a Premium plan. Configures outbound message templates triggered by job events, payment email notifications, and an optional custom webhook endpoint.
- **Lead Automations** (`/settings/lead-automations`) — available on all plans. Exposes webhook endpoints that external systems can call to log messages and calls directly to a lead's timeline without opening LeadSig.

---

## Auto Messaging (`/settings/auto-responses`)

> This page is gated behind the **Premium plan**. Owners and admins on a lower plan will see an upgrade prompt instead.

### Job Message Automation

A global **enable/disable toggle** controls whether any job message automation runs. When disabled, all templates are paused regardless of their individual settings.

#### Message Templates

You can create multiple named templates. Each template fires independently based on its own trigger and service-type filter. Templates are listed in the order they were added and can be reordered by editing.

**Per-template settings:**

| Setting | Description |
|---|---|
| **Name** | Optional label shown in the template list (e.g., "Day-before reminder"). |
| **Message content** | The text sent to the client. Supports dynamic variables (see below). |
| **Send as** | `Text`, `Email`, or `Both`. Controls which channel the message is delivered on. |
| **Jobs this message applies to** | Filter by one or more service types (e.g., Lawn Care, Pressure Washing). Leave empty to apply to all service types. |
| **Trigger timing** | When the message fires relative to a job event (see trigger options below). |
| **Offset** | How far before or after the trigger event to send. Enter a numeric value and choose a unit: `seconds`, `hours`, `days`, or `months`. Disabled when trigger is set to **Immediate**. |
| **Enabled toggle** | Each template has its own on/off switch. Disabling a template keeps it saved but stops it from firing. |

**Trigger timing options:**

- `Immediate` — fires as soon as the job event occurs (offset is ignored).
- `Before schedule start` — fires X seconds/hours/days/months before the job's scheduled start time.
- `After schedule start` — fires X seconds/hours/days/months after the job's scheduled start time.
- `After job completion` — fires X seconds/hours/days/months after the job is marked complete.

**Available template variables:**

These placeholders are replaced with real values when the message is sent:

```
{{job_name}}           The name of the job
{{client_name}}        Full client name
{{first_name}}         Client's first name only
{{service_type}}       Type of service (e.g., Lawn Care)
{{job_status}}         Current job status
{{lead_id}}            Internal lead identifier
{{scheduled_date}}     Scheduled date (date only)
{{scheduled_time}}     Scheduled time (time only)
{{scheduled_datetime}} Full scheduled date and time
```

Example: `Hi {{first_name}}, your {{service_type}} appointment is confirmed for {{scheduled_datetime}}.`

#### Custom Endpoint (Webhook Forwarding)

When enabled, every job message event is also `POST`ed to your own endpoint. This lets you pipe events into Zapier, Make, your own CRM, or any automation platform.

| Field | Description |
|---|---|
| **Endpoint URL** | The full HTTPS URL that receives the payload (e.g., `https://example.com/hooks/job-message`). |
| **Auth header name** | The HTTP header used for authentication (e.g., `Authorization`). |
| **Auth header value** | The value of that header (e.g., `Bearer <token>`). |
| **Max retry attempts** | How many times LeadSig will retry a failed delivery. Default: `3`. |
| **Retry backoff minutes** | Minutes between retry attempts. Default: `5`. |

---

### Payment Emails

A separate section below Job Message Automation. These toggles control whether LeadSig automatically emails the client when payment milestones occur. Each toggle is independent:

| Toggle | When it fires |
|---|---|
| **Estimate approved** | Client receives an email when an estimate transitions to approved status. |
| **Invoice sent** | Client receives an email when an invoice is sent. |
| **Payment logged** | Client receives an email when a payment is recorded against their account. |

All three are **on by default**.

---

## Lead Automations (`/settings/lead-automations`)

This page exposes two webhook endpoints your external tools can call to write activity directly to a lead's timeline. Both endpoints require an API key — use the **Manage API Keys** button at the bottom to create one.

Authentication header for all requests:
```
x-leadsig-api-key: <your-api-key>
```

### Messaging Bot Webhook

Use this endpoint to let an SMS bot, chat platform, or AI assistant log sent or received messages against a lead without a human opening LeadSig.

**Endpoint:**
```
POST {supabaseUrl}/functions/v1/leads-log-message
```

**Payload:**
```json
{
  "lead_id": "<optional-lead-id>",
  "client": {
    "email": "client@example.com",
    "phone": "555-123-4567"
  },
  "direction": "inbound",
  "summary": "Bot follow-up",
  "message": "Thanks for reaching out. We'll call you shortly.",
  "metadata": { "provider": "twilio" }
}
```

- `lead_id` is optional. If omitted, LeadSig matches the client by `email` or `phone`.
- `direction` is `"inbound"` (client sent it) or `"outbound"` (bot sent it).
- `metadata` is a free-form object — useful for tagging the source provider or session ID.

### Call Intake Webhook

Use this endpoint to let a call center agent or automated dialer log a call to a lead's timeline without opening LeadSig.

**Endpoint:**
```
POST {supabaseUrl}/functions/v1/leads-log-call
```

**Payload:**
```json
{
  "lead_id": "<optional-lead-id>",
  "client": {
    "external_source_id": "abc123",
    "phone": "555-123-4567"
  },
  "direction": "inbound",
  "summary": "Initial intake call",
  "notes": "Client wants paver patio quote.",
  "duration_seconds": 420,
  "call_outcome": "qualified_for_site_visit",
  "metadata": { "agent": "Sofia" }
}
```

- `external_source_id` is an ID from your external phone system, used to match the client if `lead_id` is not provided.
- `duration_seconds` is the call length in seconds.
- `call_outcome` is a free-form string describing the result (e.g., `"qualified_for_site_visit"`, `"no_answer"`, `"follow_up_scheduled"`).
- `metadata` can hold any additional data (agent name, call recording URL, etc.).

---

## Role and Permission Notes

- Only `owner` and `admin` can access these settings pages.
- `sales` can view the lead timeline entries created by webhooks but cannot change automation settings.
- API keys used for webhooks are created under `/settings/api-keys` and are scoped to the account — rotate them if an integration is decommissioned.

---

## Common Mistakes and Best Practices

| Mistake | Best Practice |
|---|---|
| Activating multiple templates at once with no testing | Enable one template at a time, send a test job through the workflow, and confirm delivery before adding more. |
| Using `Immediate` trigger with no offset when a timed reminder is needed | Set the correct trigger type (`before_schedule_start`, etc.) and enter a meaningful offset before saving. |
| Generic message text with no context | Always include at minimum `{{first_name}}`, `{{service_type}}`, and `{{scheduled_datetime}}` so the client knows exactly what the message refers to. |
| Leaving Payment Emails all on without customer opt-in flows | Review your terms of service and confirm clients expect these emails before leaving all three toggles active. |
| Not rotating the API key after a bot integration is removed | Go to `/settings/api-keys` and delete or rotate the key immediately when an integration is decommissioned. |
| Setting retry backoff to `0` on a flaky endpoint | Use at least a 5-minute backoff to avoid hammering a temporarily unavailable endpoint. |
