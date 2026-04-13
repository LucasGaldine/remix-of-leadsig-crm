# Getting Started: Settings - API Keys

## Overview

API Keys settings provide secure credentials for programmatic integrations and internal automation tooling.

## What This Area Is For

Use this settings area to:

- Generate and manage API keys.
- Rotate compromised or stale keys.
- Restrict access to authorized systems only.
- Support integration builds with traceable credential ownership.

## Core Workflow

1. Open `/settings/api-keys`.
2. Create a key for a specific integration use case.
3. Store the key in a secure secret manager.
4. Validate the integration call path.
5. Rotate keys on schedule or immediately after exposure risk.

## Key Actions and Navigation

- `API Keys Settings`: `/settings/api-keys`
- `Integration setup context`: [Settings - Integrations](./2026-04-12-settings-integrations.md)
- `Operational usage context`: [Integrations & API Keys](./2026-04-12-integrations-and-api-keys.md)

## Role and Permission Notes

- Key creation and revocation should be restricted to `owner` and `admin`.
- Avoid sharing raw keys in chat, docs, or tickets.

## Common Mistakes and Best Practices

- Mistake: Reusing one key for multiple systems.
- Best practice: Use one key per integration surface for revocation control.
- Mistake: No key rotation process.
- Best practice: Define a fixed rotation cadence and owner.
- Mistake: Storing keys in plaintext or client-side code.
- Best practice: Keep keys server-side in managed secrets.
