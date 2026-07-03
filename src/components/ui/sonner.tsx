import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, useSonner } from "sonner";
import { useToastFocusTrap } from "@/hooks/useToastFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Backdrop grisé cliquable + Escape pour fermer + focus trap.
 * Recentre l'attention sur le toast sans figer l'app plus longtemps que nécessaire.
 */
const ToastBackdrop = () => {
  const { toasts } = useSonner();
  const active = !!toasts && toasts.length > 0;
  const trapRef = useToastFocusTrap(active);
  useScrollLock(active);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        toast.dismiss();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);

  if (!active) return null;
  return (
    <div
      ref={trapRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Notification"
      onClick={() => toast.dismiss()}
      className="fixed inset-0 z-[90] bg-foreground/20 backdrop-blur-[1px] animate-in fade-in duration-150 outline-none"
    />
  );
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <ToastBackdrop />
      <Sonner
        theme={theme as ToasterProps["theme"]}
        position="top-center"
        duration={2500}
        visibleToasts={1}
        closeButton
        offset="50vh"
        className="toaster group [&_[data-sonner-toaster]]:!top-1/2 [&_[data-sonner-toaster]]:!-translate-y-1/2"
        toastOptions={{
          duration: 2500,
          classNames: {
            toast:
              "group toast !rounded-xl !border !px-5 !py-4 !min-w-[440px] !shadow-xl group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
            title: "!text-[14px] !font-semibold",
            description: "group-[.toast]:text-muted-foreground !text-[13px]",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };
