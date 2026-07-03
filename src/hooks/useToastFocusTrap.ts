import { useEffect, useRef } from "react";

/**
 * Piège le focus dans le container tant qu'il est actif.
 * Focus le premier élément focusable au montage et cycle avec Tab/Shift+Tab.
 * Restaure le focus précédent au démontage.
 */
export function useToastFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    // Capture du déclencheur : élément focusé au moment où le popup s'ouvre.
    // On ignore <body>/null (pas un vrai déclencheur clavier).
    const activeEl = document.activeElement as HTMLElement | null;
    const trigger =
      activeEl && activeEl !== document.body && typeof activeEl.focus === "function" ? activeEl : null;

    const getFocusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

    // Focus initial : premier bouton, sinon le container.
    const focusables = getFocusables();
    (focusables[0] ?? container).focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeItem = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeItem === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeItem === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKey);
    return () => {
      container.removeEventListener("keydown", handleKey);
      // Restauration du focus sur le déclencheur si toujours présent dans le DOM et focusable.
      if (trigger && document.contains(trigger)) {
        try {
          trigger.focus({ preventScroll: true });
        } catch {
          trigger.focus();
        }
      }
    };
  }, [active]);

  return ref;
}
