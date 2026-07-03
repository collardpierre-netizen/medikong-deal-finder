import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useToastFocusTrap } from "@/hooks/useToastFocusTrap";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const hasVisible = toasts.some((t) => t.open !== false);
  const trapRef = useToastFocusTrap(hasVisible);

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
          role="presentation"
          onClick={() => dismiss()}
          className="fixed inset-0 z-[99] bg-foreground/20 backdrop-blur-[1px] animate-in fade-in duration-150 outline-none"
        />
      )}
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
