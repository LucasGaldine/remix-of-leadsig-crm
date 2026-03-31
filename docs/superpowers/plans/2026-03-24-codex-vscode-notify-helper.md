# Codex VS Code Notification Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and install a tiny local VS Code extension that plays `/Users/lucasgaldine/.codex/notify.sh` once for each completed Codex response.

**Architecture:** Create a standalone VS Code extension outside the app codebase so it remains independent from OpenAI's extension and from this repo's product code. Detect Codex response completion using observable Codex conversation/editor changes, debounce streaming updates into one event, and shell out to the existing notification script asynchronously.

**Tech Stack:** VS Code Extension API, TypeScript, Node.js child process APIs, macOS shell script execution

---

### Task 1: Create the standalone extension scaffold

**Files:**
- Create: `/Users/lucasgaldine/.codex/codex-notify-vscode/package.json`
- Create: `/Users/lucasgaldine/.codex/codex-notify-vscode/tsconfig.json`
- Create: `/Users/lucasgaldine/.codex/codex-notify-vscode/src/extension.ts`
- Create: `/Users/lucasgaldine/.codex/codex-notify-vscode/.vscodeignore`
- Create: `/Users/lucasgaldine/.codex/codex-notify-vscode/README.md`

- [ ] **Step 1: Create the extension folder structure under `/Users/lucasgaldine/.codex/codex-notify-vscode`**
- [ ] **Step 2: Write `package.json` with activation on startup, a `main` entrypoint, build scripts, and `vscode` as the only runtime dependency target**
- [ ] **Step 3: Write `tsconfig.json` for a standard VS Code extension TypeScript build targeting CommonJS output in `dist/`**
- [ ] **Step 4: Write a minimal `README.md` with local install and reload instructions**
- [ ] **Step 5: Write `.vscodeignore` so packaging excludes source-control noise and local caches**

### Task 2: Add a failing local reproduction for notification triggering

**Files:**
- Create: `/Users/lucasgaldine/.codex/codex-notify-vscode/src/extension.ts`
- Test: manual verification in VS Code extension host

- [ ] **Step 1: Add extension activation logging so the extension host confirms startup**
- [ ] **Step 2: Add temporary listeners for `workspace.onDidChangeTextDocument` and `window.onDidChangeVisibleTextEditors` that log Codex-related URIs, schemes, and document growth**
- [ ] **Step 3: Launch the extension in an Extension Development Host and send a prompt in the Codex panel**
- [ ] **Step 4: Inspect the extension host logs to identify the most stable Codex-specific signal available on this machine**
- [ ] **Step 5: Remove any temporary logging that is broader than the final detection needs**

### Task 3: Implement Codex completion detection with debounce

**Files:**
- Modify: `/Users/lucasgaldine/.codex/codex-notify-vscode/src/extension.ts`
- Test: manual verification in VS Code extension host

- [ ] **Step 1: Add helpers that recognize Codex-related documents or editors, preferring `openai-codex` and Codex custom-editor/scheme identifiers when available**
- [ ] **Step 2: Track per-document state so streaming text growth can be coalesced into one completion event**
- [ ] **Step 3: Implement a short debounce timer that fires only after response updates settle**
- [ ] **Step 4: Ignore non-Codex documents and obvious user-input changes so normal editing never triggers sound**
- [ ] **Step 5: Keep the detection logic in small helper functions so future OpenAI extension changes are easy to adjust**

### Task 4: Execute the notification script safely

**Files:**
- Modify: `/Users/lucasgaldine/.codex/codex-notify-vscode/src/extension.ts`
- Test: manual verification in VS Code extension host

- [ ] **Step 1: Add a constant for `/Users/lucasgaldine/.codex/notify.sh`**
- [ ] **Step 2: Check that the script exists before first execution and show at most one warning if it does not**
- [ ] **Step 3: Execute `zsh /Users/lucasgaldine/.codex/notify.sh` asynchronously using Node child-process APIs**
- [ ] **Step 4: Log execution failures to the extension host console without interrupting VS Code**
- [ ] **Step 5: Add a final guard so one completed Codex response yields one script invocation**

### Task 5: Build, install, and verify the helper extension

**Files:**
- Modify: `/Users/lucasgaldine/.codex/codex-notify-vscode/package.json`
- Modify: `/Users/lucasgaldine/.codex/codex-notify-vscode/README.md`
- Test: local VS Code installation

- [ ] **Step 1: Install build-time dependencies needed for the local extension, such as TypeScript and VS Code extension typings**
- [ ] **Step 2: Run the build and confirm the compiled output appears in `dist/` without TypeScript errors**
- [ ] **Step 3: Install the extension locally using the simplest supported path for this machine, either Extension Development Host or packaged VSIX**
- [ ] **Step 4: Send multiple prompts in the Codex panel and confirm each completed response plays exactly one sound**
- [ ] **Step 5: Verify unrelated editor changes and non-Codex activity do not play sounds**
- [ ] **Step 6: Update `README.md` with the exact install, rebuild, and reload commands that worked**

### Task 6: Final verification and cleanup

**Files:**
- Modify: `/Users/lucasgaldine/.codex/codex-notify-vscode/src/extension.ts`
- Modify: `/Users/lucasgaldine/.codex/codex-notify-vscode/README.md`

- [ ] **Step 1: Remove leftover debug logging that is not useful for ongoing maintenance**
- [ ] **Step 2: Rebuild the extension after cleanup**
- [ ] **Step 3: Re-run the manual notification check with at least two Codex responses**
- [ ] **Step 4: Document any known detection limitations in `README.md`, especially dependence on observable Codex document behavior**
- [ ] **Step 5: Commit the extension files and documentation with a message such as `feat: add local Codex VS Code notification helper`**
