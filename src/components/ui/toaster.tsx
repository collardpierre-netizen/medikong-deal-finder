import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();
  const hasVisible = toasts.some((t) => t.open !== false);

  return (
    <ToastProvider>
      {hasVisible && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[99] bg-foreground/20 backdrop-blur-[1px] animate-in fade-in duration-150"
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
