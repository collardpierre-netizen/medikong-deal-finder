import { useEffect, useId } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useToastFocusTrap } from "@/hooks/useToastFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const hasVisible = toasts.some((t) => t.open !== false);
  const trapRef = useToastFocusTrap(hasVisible);
  useScrollLock(hasVisible);
  const baseId = useId();

  useEffect(() => {
    if (!hasVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [hasVisible, dismiss]);

  return (
    <ToastProvider>
      {hasVisible && (
        <div
          ref={trapRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Notification"
          onClick={() => dismiss()}
          className="fixed inset-0 z-[99] bg-foreground/20 backdrop-blur-[1px] animate-in fade-in duration-150 outline-none"
        />
      )}
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const titleId = title ? `${baseId}-${id}-title` : undefined;
        const descId = description ? `${baseId}-${id}-desc` : undefined;
        return (
          <Toast
            key={id}
            {...props}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <div className="grid gap-1">
              {title && <ToastTitle id={titleId}>{title}</ToastTitle>}
              {description && <ToastDescription id={descId}>{description}</ToastDescription>}
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
