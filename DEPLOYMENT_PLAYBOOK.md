# Deployment Playbook (MCP-First)

This repo uses an `MCP-first` deployment workflow.

## Core Rule

For any deployment request, always attempt deployment through MCP/app tools first.

- If MCP deployment capability exists for the target, use MCP.
- If MCP deployment capability does not exist, explicitly state that and then use CLI as fallback.

## Required Pre-Flight Check

Before running any deploy command:

1. Identify deploy target/environment.
2. Check whether an MCP/app deployment tool exists for that target.
3. State one-line plan before action:
   - `Plan: deploy via MCP (<tool-name>)`
   - or `Plan: MCP unavailable for <target>; falling back to CLI (<command>)`

## Execution Order (Non-Negotiable)

1. MCP deploy path.
2. MCP logs/status verification.
3. CLI fallback only if MCP path is unavailable or failing due to missing capability.

## Guardrails

- Do not start with CLI when a known MCP deploy path exists.
- Do not claim deployment is blocked until MCP capability has been checked.
- If switching from MCP to CLI, state the reason in one sentence.

## Deployment Response Template

Use this format for every deployment task:

1. `Target`: <env/service>
2. `MCP Capability`: <tool found/not found>
3. `Plan`: <MCP deploy or CLI fallback>
4. `Result`: <success/failure + next action>

## Quick Checklist

- [ ] Confirm target environment/service.
- [ ] Check MCP deployment tool availability.
- [ ] Announce one-line plan.
- [ ] Execute MCP deployment if available.
- [ ] Verify deploy status/logs.
- [ ] Use CLI only if MCP is unavailable for that target.
- [ ] Report outcome with the response template.
