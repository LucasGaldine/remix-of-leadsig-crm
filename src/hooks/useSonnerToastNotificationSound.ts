import { useEffect } from "react";
import { initializeNotificationSound, playNotificationSound } from "@/lib/notificationSound";

function collectSonnerToastNodes(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) {
    return [];
  }

  const nodes: HTMLElement[] = [];
  if (node.matches("[data-sonner-toast]")) {
    nodes.push(node);
  }
  nodes.push(...Array.from(node.querySelectorAll<HTMLElement>("[data-sonner-toast]")));

  return nodes;
}

export function useSonnerToastNotificationSound() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    initializeNotificationSound();
    const playedNodes = new WeakSet<HTMLElement>();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          const toastNodes = collectSonnerToastNodes(node);
          for (const toastNode of toastNodes) {
            if (playedNodes.has(toastNode)) {
              continue;
            }
            playedNodes.add(toastNode);
            playNotificationSound();
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);
}
