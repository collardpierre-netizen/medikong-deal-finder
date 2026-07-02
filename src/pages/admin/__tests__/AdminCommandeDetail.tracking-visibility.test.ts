import { describe, it, expect } from "vitest";

/**
 * Contrat de visibilité des actions du bloc "Suivi d'expédition" côté
 * /admin/commandes/:id (src/pages/admin/AdminCommandeDetail.tsx).
 *
 * Les conditions ci-dessous DOIVENT rester alignées avec le JSX inline
 * du composant. Toute modification des règles dans le composant doit
 * être répercutée ici, et vice-versa.
 *
 * Règles (extraites du composant) :
 *   - "Marquer expédié & notifier"  : status !== "shipped" && status !== "delivered"
 *   - "Enregistrer & renotifier"    : status !== "delivered"
 *   - "🧪 Tester (dry-run)"          : status !== "delivered"
 *   - Message "Commande livrée"     : status === "delivered"
 *   - "Enregistrer sans email"      : toujours visible
 */

const shouldShowMarkShipped = (status: string) =>
  status !== "shipped" && status !== "delivered";
const shouldShowRenotify = (status: string) => status !== "delivered";
const shouldShowDryRun = (status: string) => status !== "delivered";
const shouldShowDeliveredMessage = (status: string) => status === "delivered";
const shouldShowSaveWithoutEmail = (_status: string) => true;

describe("AdminCommandeDetail — visibilité des actions Suivi d'expédition", () => {
  describe('status = "delivered"', () => {
    const status = "delivered";
    it("masque le bouton 'Marquer expédié & notifier'", () => {
      expect(shouldShowMarkShipped(status)).toBe(false);
    });
    it("masque le bouton 'Enregistrer & renotifier l'acheteur'", () => {
      expect(shouldShowRenotify(status)).toBe(false);
    });
    it("masque le bouton '🧪 Tester (dry-run)'", () => {
      expect(shouldShowDryRun(status)).toBe(false);
    });
    it("affiche le message 'Commande livrée'", () => {
      expect(shouldShowDeliveredMessage(status)).toBe(true);
    });
    it("garde le bouton 'Enregistrer sans email' visible", () => {
      expect(shouldShowSaveWithoutEmail(status)).toBe(true);
    });
  });

  describe('status = "shipped"', () => {
    const status = "shipped";
    it("masque 'Marquer expédié & notifier' (déjà expédiée)", () => {
      expect(shouldShowMarkShipped(status)).toBe(false);
    });
    it("affiche 'Enregistrer & renotifier'", () => {
      expect(shouldShowRenotify(status)).toBe(true);
    });
    it("affiche '🧪 Tester (dry-run)'", () => {
      expect(shouldShowDryRun(status)).toBe(true);
    });
    it("masque le message 'Commande livrée'", () => {
      expect(shouldShowDeliveredMessage(status)).toBe(false);
    });
  });

  describe.each(["pending", "confirmed", "processing"])('status = "%s"', (status) => {
    it("affiche toutes les actions et pas de message livré", () => {
      expect(shouldShowMarkShipped(status)).toBe(true);
      expect(shouldShowRenotify(status)).toBe(true);
      expect(shouldShowDryRun(status)).toBe(true);
      expect(shouldShowDeliveredMessage(status)).toBe(false);
    });
  });
});
