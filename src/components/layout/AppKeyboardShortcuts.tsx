import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getKeyboardShortcutHelp,
  OPEN_GLOBAL_SEARCH_EVENT,
  resolveDirectShortcut,
  resolvePrefixedShortcut,
  shouldIgnoreShortcutTarget,
  type ShortcutPrefix,
} from "@/lib/keyboardShortcuts";

const PREFIX_TIMEOUT_MS = 1200;

export function AppKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager } = useAuth();
  const prefixRef = useRef<ShortcutPrefix | null>(null);
  const clearPrefixTimeoutRef = useRef<number | null>(null);

  const clearPrefix = useCallback(() => {
    prefixRef.current = null;

    if (clearPrefixTimeoutRef.current !== null) {
      window.clearTimeout(clearPrefixTimeoutRef.current);
      clearPrefixTimeoutRef.current = null;
    }
  }, []);

  const setPrefix = useCallback(
    (prefix: ShortcutPrefix) => {
      clearPrefix();
      prefixRef.current = prefix;
      clearPrefixTimeoutRef.current = window.setTimeout(() => {
        clearPrefix();
      }, PREFIX_TIMEOUT_MS);
    },
    [clearPrefix],
  );

  useEffect(() => {
    const handleAction = (action: ReturnType<typeof resolveDirectShortcut> | ReturnType<typeof resolvePrefixedShortcut>) => {
      if (!action) return false;

      if (action.type === "open-search") {
        window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_SEARCH_EVENT));
        return true;
      }

      if (action.type === "show-help") {
        toast.info("Keyboard shortcuts", {
          description: getKeyboardShortcutHelp(isManager()).join("\n"),
          duration: 7000,
        });
        return true;
      }

      const currentPath = `${location.pathname}${location.search}`;
      if (currentPath !== action.path) {
        navigate(action.path);
      }

      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        clearPrefix();
        return;
      }

      const directAction = resolveDirectShortcut(event.key, event);
      if (directAction) {
        event.preventDefault();
        clearPrefix();
        handleAction(directAction);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        clearPrefix();
        return;
      }

      const key = event.key.toLowerCase();
      const activePrefix = prefixRef.current;

      if (activePrefix) {
        const action = resolvePrefixedShortcut(activePrefix, key, isManager());
        clearPrefix();

        if (action) {
          event.preventDefault();
          handleAction(action);
        }

        return;
      }

      if (key === "g" || key === "n") {
        setPrefix(key as ShortcutPrefix);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearPrefix();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearPrefix, isManager, location.pathname, location.search, navigate, setPrefix]);

  return null;
}
