import { describe, expect, it } from "vitest";
import {
  getKeyboardShortcutHelp,
  resolveDirectShortcut,
  resolvePrefixedShortcut,
  shouldIgnoreShortcutTarget,
} from "@/lib/keyboardShortcuts";

describe("keyboardShortcuts", () => {
  it("ignores editable targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");

    expect(shouldIgnoreShortcutTarget(input)).toBe(true);
    expect(shouldIgnoreShortcutTarget(textarea)).toBe(true);
    expect(shouldIgnoreShortcutTarget(select)).toBe(true);
    expect(shouldIgnoreShortcutTarget(contentEditable)).toBe(true);
  });

  it("does not ignore non-editable targets", () => {
    const button = document.createElement("button");
    expect(shouldIgnoreShortcutTarget(button)).toBe(false);
  });

  it("resolves direct shortcuts", () => {
    const openSearch = resolveDirectShortcut("k", {
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    });
    const showHelp = resolveDirectShortcut("?", {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
    });

    expect(openSearch).toEqual({ type: "open-search" });
    expect(showHelp).toEqual({ type: "show-help" });
  });

  it("resolves prefixed navigation shortcuts", () => {
    expect(resolvePrefixedShortcut("g", "j", true)).toEqual({ type: "navigate", path: "/jobs" });
    expect(resolvePrefixedShortcut("g", "l", true)).toEqual({ type: "navigate", path: "/leads" });
    expect(resolvePrefixedShortcut("g", "l", false)).toBeNull();
  });

  it("resolves quick-action shortcuts for managers only", () => {
    expect(resolvePrefixedShortcut("n", "e", true)).toEqual({ type: "navigate", path: "/payments/estimates/new" });
    expect(resolvePrefixedShortcut("n", "i", true)).toEqual({ type: "navigate", path: "/payments/invoices/new" });
    expect(resolvePrefixedShortcut("n", "e", false)).toBeNull();
  });

  it("includes manager-only help entries conditionally", () => {
    const managerHelp = getKeyboardShortcutHelp(true);
    const crewHelp = getKeyboardShortcutHelp(false);

    expect(managerHelp.some((entry) => entry.includes("Leads"))).toBe(true);
    expect(managerHelp.some((entry) => entry.includes("New estimate"))).toBe(true);
    expect(crewHelp.some((entry) => entry.includes("Leads"))).toBe(false);
    expect(crewHelp.some((entry) => entry.includes("New estimate"))).toBe(false);
  });
});
