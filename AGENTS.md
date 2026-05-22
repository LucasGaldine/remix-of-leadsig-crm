# AGENTS Deployment Policy

This repository enforces MCP-first deployment behavior.

## Non-Negotiable Rules

1. All deployment actions must be executed through MCP tools.
2. CLI deployment commands are forbidden by default.
3. CLI deployment is allowed only when the user explicitly approves it in the current turn.
4. If MCP deployment fails, stop and report the MCP error. Do not switch to CLI automatically. If you get a 403 error, you likely deployed with CLI and need to retry with MCP

## Required Preflight

Before any deployment action, declare:

`DEPLOY_METHOD=MCP`

## Canonical Entrypoints

- `npm run deploy`
- `npm run deploy:mcp`

Both map to the MCP-only deploy wrapper and fail closed outside MCP context.

### Non-Negotiable Test Rules

If the user asks you to run tests, do the following:

1. Run Vite/unit test coverage for the changed behavior using the project test suite (`npm run test`).
2. Run Playwright end-to-end coverage for user-facing behavior (`npm run test:e2e` or a scoped Playwright project/spec when appropriate).
3. Do not mark work as complete unless required Vite and Playwright tests pass
4. If a test fails try to fix and retest, if the blocking failure is not something you can fix, notify the user
