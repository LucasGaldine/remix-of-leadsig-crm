# Job Message Automation Design

## Goal
Add configurable job messaging automation rules that let an account define message content, target service types (jobs), timing/trigger logic, and a destination endpoint that receives a complete payload when a message event should fire.

## Assumptions
- Rules are account-scoped and stored in `accounts.settings`.
- “Jobs” selection maps to `leads.service_type` values.
- Trigger timing needs immediate and schedule-relative modes.
- Endpoint delivery should be server-side (not from browser), with retries + failure logs.

## Data Model
Add a new settings key: `job_message_automation`.

```json
{
  "enabled": true,
  "message_template": "Reminder: {{job_name}} is scheduled for {{scheduled_date}}",
  "job_service_types": ["Pavers / Patio", "Concrete"],
  "trigger": {
    "type": "before_schedule_start",
    "offset_minutes": 120
  },
  "endpoint": {
    "url": "https://example.com/hooks/job-message",
    "auth_header_name": "Authorization",
    "auth_header_value": "Bearer abc123"
  },
  "retry": {
    "max_attempts": 3,
    "backoff_minutes": 5
  }
}
```

## Backend Architecture
1. Add queue/log tables:
- `message_automation_events` (queued + retryable deliveries)
- `message_automation_delivery_log` (history of attempts + responses)

2. Add trigger functions:
- On `leads` insert/update (job lifecycle changes)
- On `job_schedules` insert/update (schedule-based triggers)

3. Trigger function behavior:
- Load account rule from `accounts.settings`.
- Exit if disabled or service type not selected.
- Compute `scheduled_for` from trigger type:
  - `immediate`
  - `before_schedule_start` (start - offset)
  - `after_schedule_start` (start + offset)
- Insert queue row with fully prepared payload.

4. Add edge function `dispatch-job-message-automation`:
- Select due queue rows.
- POST payload to configured endpoint with optional auth header.
- Mark success or failure.
- Retry failures up to `max_attempts` with backoff.
- Log each attempt in delivery log.

5. Add pg_cron schedule (every minute) to invoke dispatcher.

## Payload Contract
```json
{
  "event_type": "job_message_automation",
  "message": "rendered message",
  "account_id": "uuid",
  "lead": {
    "id": "uuid",
    "name": "...",
    "service_type": "...",
    "status": "...",
    "scheduled_date": "YYYY-MM-DD",
    "scheduled_time_start": "HH:MM:SS"
  },
  "schedule": {
    "id": "uuid",
    "scheduled_date": "YYYY-MM-DD",
    "scheduled_time_start": "HH:MM:SS",
    "scheduled_time_end": "HH:MM:SS"
  },
  "trigger": {
    "type": "before_schedule_start",
    "offset_minutes": 120,
    "scheduled_for": "ISO timestamp"
  },
  "generated_at": "ISO timestamp"
}
```

## UI
Extend `SettingsLeadAutomations` with a “Job Message Automation” card:
- Enable switch
- Message template textarea
- Multi-select service types
- Trigger type select
- Offset minutes input (for before/after schedule trigger)
- Endpoint URL input
- Auth header name + value inputs

## Testing
- `SettingsLeadAutomations` tests for field hydration + save payload + service-type multi-select.
- New unit tests for frontend helper logic (trigger scheduling + payload construction primitives).
- Manual verification path for endpoint retry/failure via DB queue/log rows.
