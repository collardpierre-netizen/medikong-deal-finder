import { test, expect } from "@playwright/test";

/**
 * Vérifie que, côté /admin/commandes/:id, les actions de renotification
 * sont masquées et le message "Commande livrée" est affiché quand le
 * statut de la commande est "delivered", et qu'elles sont visibles quand
 * le statut est "shipped".
 *
 * Fixtures attendues (env) :
 *   - LOVABLE_BROWSER_SUPABASE_* (session admin injectée automatiquement
 *     par la sandbox pour un utilisateur admin)
 *   - E2E_ORDER_ID_DELIVERED : UUID d'une commande status=delivered
 *   - E2E_ORDER_ID_SHIPPED   : UUID d'une commande status=shipped
 *
 * Si l'une de ces variables est absente, le test est skippé (pas d'échec
 * en CI sur un environnement non-provisionné).
 *
 * Contrat testé (src/pages/admin/AdminCommandeDetail.tsx, bloc "Suivi
 * d'expédition") :
 *   - status === "delivered" :
 *       - bouton "Enregistrer & renotifier l'acheteur"   → MASQUÉ
 *       - bouton "🧪 Tester (dry-run)"                    → MASQUÉ
 *       - bouton "Marquer expédié & notifier l'acheteur"  → MASQUÉ
 *       - message "Commande livrée"                       → VISIBLE
 *       - bouton "Enregistrer sans email"                 → VISIBLE (toujours)
 *   - status === "shipped" :
 *       - bouton "Enregistrer & renotifier l'acheteur"   → VISIBLE
 *       - bouton "🧪 Tester (dry-run)"                    → VISIBLE
 *       - message "Commande livrée"                       → MASQUÉ
 */

const DELIVERED_ID = process.env.E2E_ORDER_ID_DELIVERED;
const SHIPPED_ID = process.env.E2E_ORDER_ID_SHIPPED;
const AUTH_STATUS = process.env.LOVABLE_BROWSER_AUTH_STATUS;

// Sélecteurs stables (labels visibles)
const RENOTIFY_LABEL = /Enregistrer & renotifier l'acheteur/i;
const DRYRUN_LABEL = /Tester \(dry-run\)/i;
const MARK_SHIPPED_LABEL = /Marquer expédié & notifier l'acheteur/i;
const DELIVERED_MSG = /Commande livrée/i;
const SAVE_WITHOUT_EMAIL_LABEL = /Enregistrer sans email/i;

test.describe("Admin – Suivi d'expédition : gating des actions selon le statut", () => {
  test.skip(
    AUTH_STATUS !== "injected",
    "Session admin non injectée (LOVABLE_BROWSER_AUTH_STATUS != 'injected')",
  );

  test("masque renotify + dry-run et affiche le message quand status=delivered", async ({ page }) => {
    test.skip(!DELIVERED_ID, "E2E_ORDER_ID_DELIVERED non fourni");

    await page.goto(`/admin/commandes/${DELIVERED_ID}`, { waitUntil: "domcontentloaded" });

    // Attendre le rendu du bloc suivi (toujours présent : bouton "Enregistrer sans email")
    await expect(page.getByRole("button", { name: SAVE_WITHOUT_EMAIL_LABEL })).toBeVisible({
      timeout: 15_000,
    });

    // Message "Commande livrée" présent
    await expect(page.getByText(DELIVERED_MSG).first()).toBeVisible();

    // Actions de renotification masquées
    await expect(page.getByRole("button", { name: RENOTIFY_LABEL })).toHaveCount(0);
    await expect(page.getByRole("button", { name: DRYRUN_LABEL })).toHaveCount(0);
    await expect(page.getByRole("button", { name: MARK_SHIPPED_LABEL })).toHaveCount(0);
  });

  test("affiche renotify + dry-run et pas de message quand status=shipped", async ({ page }) => {
    test.skip(!SHIPPED_ID, "E2E_ORDER_ID_SHIPPED non fourni");

    await page.goto(`/admin/commandes/${SHIPPED_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: SAVE_WITHOUT_EMAIL_LABEL })).toBeVisible({
      timeout: 15_000,
    });

    // Renotify + dry-run visibles
    await expect(page.getByRole("button", { name: RENOTIFY_LABEL })).toBeVisible();
    await expect(page.getByRole("button", { name: DRYRUN_LABEL })).toBeVisible();

    // Pas de message "Commande livrée"
    await expect(page.getByText(DELIVERED_MSG)).toHaveCount(0);
  });
});
