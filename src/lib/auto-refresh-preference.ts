/**
 * Préférence utilisateur : désactiver l'auto-rafraîchissement contrôlé
 * lorsqu'une nouvelle version frontend est détectée.
 *
 * Quand la préférence est activée (= auto-refresh désactivé) :
 *  - `installBuildVersionWatcher` ne recharge jamais automatiquement.
 *  - `preflightBuildVersionBeforeRender` laisse passer le boot sans reload.
 *  - Le toast "Nouvelle version disponible" reste affiché pour permettre
 *    un rechargement manuel via son CTA.
 *
 * Source de vérité : localStorage (clef ci-dessous).
 * Miroir best-effort dans `profiles.preferences.disable_auto_refresh`
 * via la RPC `set_user_preference` (facultatif, côté UI).
 */

const KEY = "medikong.auto-refresh.disabled";

export function isAutoRefreshDisabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoRefreshDisabled(disabled: boolean): void {
  try {
    if (typeof window === "undefined") return;
    if (disabled) {
      window.localStorage.setItem(KEY, "1");
    } else {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

export const AUTO_REFRESH_PREF_KEY = KEY;
