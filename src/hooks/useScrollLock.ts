import { useEffect } from "react";

/**
 * Bloque le scroll de <body> tant que `active` est vrai, restaure à la fermeture.
 * Utilise un compteur global pour supporter plusieurs popups simultanés.
 */
let lockCount = 0;
let previousOverflow: string | null = null;
let previousPaddingRight: string | null = null;

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      const body = document.body;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      previousOverflow = body.style.overflow;
      previousPaddingRight = body.style.paddingRight;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        // Compense la disparition de la scrollbar pour éviter le layout shift.
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow ?? "";
        document.body.style.paddingRight = previousPaddingRight ?? "";
        previousOverflow = null;
        previousPaddingRight = null;
      }
    };
  }, [active]);
}
