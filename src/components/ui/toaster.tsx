import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { initializeNotificationSound, playNotificationSound } from "@/lib/notificationSound";

export function Toaster() {
  const { toasts } = useToast();
  const seenToastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initializeNotificationSound();

    const currentToastIds = new Set(toasts.map((toast) => toast.id));
    for (const toast of toasts) {
      if (toast.open === false) {
        continue;
      }
      if (seenToastIdsRef.current.has(toast.id)) {
        continue;
      }

      playNotificationSound({ key: `shadcn:${toast.id}` });
    }

    seenToastIdsRef.current = currentToastIds;
  }, [toasts]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
