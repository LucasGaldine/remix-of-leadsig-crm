export const OPEN_GLOBAL_SEARCH_EVENT = "leadsig:open-global-search";

export type ShortcutPrefix = "g" | "n";

export type ShortcutAction =
  | { type: "navigate"; path: string }
  | { type: "open-search" }
  | { type: "show-help" };

type ModifierState = Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("[contenteditable='true'], [role='textbox']"));
}

export function resolveDirectShortcut(key: string, modifiers: ModifierState): ShortcutAction | null {
  const normalizedKey = key.toLowerCase();

  if ((modifiers.metaKey || modifiers.ctrlKey) && !modifiers.altKey && normalizedKey === "k") {
    return { type: "open-search" };
  }

  if (!modifiers.metaKey && !modifiers.ctrlKey && !modifiers.altKey && modifiers.shiftKey && normalizedKey === "?") {
    return { type: "show-help" };
  }

  return null;
}

export function resolvePrefixedShortcut(
  prefix: ShortcutPrefix,
  key: string,
  isManager: boolean,
): ShortcutAction | null {
  const normalizedKey = key.toLowerCase();

  if (prefix === "g") {
    if (normalizedKey === "d" || normalizedKey === "h") return { type: "navigate", path: "/" };
    if (normalizedKey === "j") return { type: "navigate", path: "/jobs" };
    if (normalizedKey === "c") return { type: "navigate", path: "/schedule" };
    if (normalizedKey === "u") return { type: "navigate", path: "/customers" };
    if (normalizedKey === "s") return { type: "navigate", path: "/settings" };
    if (normalizedKey === "l" && isManager) return { type: "navigate", path: "/leads" };
    if (normalizedKey === "p" && isManager) return { type: "navigate", path: "/payments" };
    return null;
  }

  if (prefix === "n") {
    if (!isManager) return null;
    if (normalizedKey === "e") return { type: "navigate", path: "/payments/estimates/new" };
    if (normalizedKey === "i") return { type: "navigate", path: "/payments/invoices/new" };
  }

  return null;
}

export function getKeyboardShortcutHelp(isManager: boolean): string[] {
  const shortcuts = [
    "Ctrl/Cmd+K: Open search",
    "?: Show shortcuts",
    "G then D/H: Dashboard",
    "G then J: Jobs",
    "G then C: Schedule",
    "G then U: Customers",
    "G then S: Settings",
  ];

  if (isManager) {
    shortcuts.push("G then L: Leads", "G then P: Payments", "N then E: New estimate", "N then I: New invoice");
  }

  return shortcuts;
}
