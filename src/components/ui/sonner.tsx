import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, useSonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Backdrop grisé affiché tant qu'un toast est visible.
 * Non bloquant (pointer-events-none) : l'UI reste utilisable,
 * mais le focus visuel est ramené au centre de l'écran.
 */
const ToastBackdrop = () => {
  const { toasts } = useSonner();
  if (!toasts || toasts.length === 0) return null;
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[90] bg-foreground/20 backdrop-blur-[1px] pointer-events-none animate-in fade-in duration-150"
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
              "group toast !rounded-xl !border !px-5 !py-4 !min-w-[320px] !shadow-xl group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
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
