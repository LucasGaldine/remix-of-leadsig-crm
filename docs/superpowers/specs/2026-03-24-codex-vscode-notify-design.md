# Codex VS Code Notification Helper Design

**Goal**

Play an audible notification on macOS for every completed Codex response in VS Code, even when the built-in Codex CLI `notify` setting does not fire for the VS Code extension workflow.

**Scope**

- The solution is local to this machine and does not modify the OpenAI Codex extension.
- The solution may trigger on Codex chat activity in VS Code generally, not only one specific thread.
- The notification action will reuse the existing shell script at `/Users/lucasgaldine/.codex/notify.sh`.
- The helper should be lightweight, read-only, and easy to reinstall after VS Code updates.

**Recommended Approach**

Build a tiny local VS Code extension that observes Codex conversation updates and runs the existing notification script when an assistant turn completes.

This is the lowest-maintenance option we control directly. It avoids patching the OpenAI extension, and it is less brittle than UI automation tools such as AppleScript or Hammerspoon.

**Architecture**

- A standalone local extension project lives outside the app code and is installed into VS Code as an unpacked extension.
- The extension activates on startup.
- It listens for Codex-related document or editor/session changes that are visible to other extensions.
- When a change matches the completion heuristic, it spawns `zsh /Users/lucasgaldine/.codex/notify.sh`.
- A short debounce prevents duplicate sounds from a single response.

**Detection Strategy**

The design uses a two-level trigger strategy:

1. Prefer a Codex-specific signal when available.
   - Match Codex conversation documents or editors associated with the `openai-codex` session type or the Codex custom editor scheme.
   - Treat an appended assistant message or a turn-finalization marker as a completion event.

2. Fall back to a narrow heuristic if no explicit completion event is exposed cross-extension.
   - Watch Codex conversation document changes only.
   - Ignore user-authored input-like changes.
   - Trigger only when the document grows in a way consistent with a finalized assistant response.
   - Use a debounce window so streaming updates result in one sound, not many.

This keeps the extension usable even if the OpenAI extension does not expose an official public event for turn completion.

**Behavior**

- Every completed Codex response plays one sound.
- Repeated streaming updates during the same response must not produce repeated sounds.
- If the script path is missing or fails to launch, the helper logs an error to the VS Code extension host console and remains otherwise non-blocking.
- The helper should not request elevated permissions or modify workspace files.

**Error Handling**

- Validate that `/Users/lucasgaldine/.codex/notify.sh` exists before attempting execution.
- Execute the script asynchronously so the editor UI is never blocked.
- Surface failures through `console.error` and optionally a one-time VS Code warning if the script is missing.
- Keep the failure mode silent with respect to editor functionality: missing notification support must not affect Codex usage.

**Testing**

- Manual verification:
  - install the helper extension locally
  - send a prompt in the Codex VS Code panel
  - confirm one sound plays when the response completes
  - confirm streaming output does not create multiple sounds
  - confirm a second prompt produces a second sound
- Negative verification:
  - confirm unrelated file edits do not play sounds
  - confirm non-Codex editor activity does not play sounds
- Failure verification:
  - temporarily point the script path to a missing file and confirm the extension fails safely without disrupting VS Code

**Tradeoffs**

- The extension may rely on observable Codex document behavior rather than a public completion API, so a future OpenAI extension update could require a small adjustment.
- Even with that limitation, this approach is still less fragile than patching the vendor extension or automating the VS Code UI at the OS level.
