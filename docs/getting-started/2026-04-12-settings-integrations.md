# Getting Started: Settings - Integrations

## Overview

Settings Integrations covers connection setup and account-level configuration for third-party systems.

## What This Area Is For

Use this settings area to:

- Connect external platforms (payments, lead sources, accounting).
- Authorize and maintain connection health.
- Confirm integration status before operational use.
- Disconnect or re-authorize integrations safely.

## Core Workflow

1. Open relevant integration settings page (for example `/settings/stripe`).
2. Start OAuth/auth connection flow.
3. Confirm successful callback and connected status.
4. Run a basic functional test (small, low-risk transaction/event).
5. Document owner of each integration and review connection status regularly.

## Key Actions and Navigation

- `Stripe Integration Settings`: `/settings/stripe`
- `Lead Source Configuration`: `/settings/lead-sources`
- `API key setup page`: `/settings/api-keys`
- `Operational integration usage`: [Integrations & API Keys](./2026-04-12-integrations-and-api-keys.md)

## Role and Permission Notes

- Integration setup should be limited to `owner` and `admin`.
- Avoid shared credentials outside designated integration owners.

## Common Mistakes and Best Practices

- Mistake: Marking setup complete without an end-to-end test.
- Best practice: Verify one real workflow after every connect/reconnect.
- Mistake: No owner assigned for each integration.
- Best practice: Assign clear ownership and escalation contact.
- Mistake: Mixing setup docs with runtime operations.
- Best practice: Keep setup here and operational playbooks in [Integrations & API Keys](./2026-04-12-integrations-and-api-keys.md).
