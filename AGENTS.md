# AGENTS Deployment Policy

## Non-Negotiable Rules

1. Always deploy yourself, never say the next step is to deploy

### Non-Negotiable Test Rules

If you believe it makes sense to run tests, do the following:

1. Run Vite/unit test coverage for the changed behavior using the project test suite (`npm run test`).
2. Run Playwright end-to-end coverage for user-facing behavior (`npm run test:e2e` or a scoped Playwright project/spec when appropriate).
3. Do not mark work as complete unless required Vite and Playwright tests pass
4. If a test fails try to fix and retest, if the blocking failure is not something you can fix, notify the user
