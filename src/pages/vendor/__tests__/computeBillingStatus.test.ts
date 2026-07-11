import { describe, it, expect } from "vitest";
import { computeBillingStatus } from "../VendorOrders";

type Order = Parameters<typeof computeBillingStatus>[0];

const makeOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    order_status: "confirmed",
    payment_status: "pending",
    invoices: [],
    ...overrides,
  } as Order);

const inv = (status: string) => ({ status } as Order["invoices"][number]);

describe("computeBillingStatus", () => {
  it("retourne 'Annulée' quand la commande est annulée (prime sur tout)", () => {
    const r = computeBillingStatus(
      makeOrder({ order_status: "cancelled", payment_status: "paid", invoices: [inv("paid")] }),
    );
    expect(r).toEqual({ label: "Annulée", color: "default", title: "Commande annulée" });
  });

  describe("avec factures", () => {
    it("'Payée' si toutes les factures sont payées", () => {
      const r = computeBillingStatus(makeOrder({ invoices: [inv("paid"), inv("paid")] }));
      expect(r?.label).toBe("Payée");
      expect(r?.color).toBe("success");
    });

    it("'Payée' si payment_status='paid' même avec factures non payées", () => {
      const r = computeBillingStatus(
        makeOrder({ payment_status: "paid", invoices: [inv("pending")] }),
      );
      expect(r?.label).toBe("Payée");
      expect(r?.color).toBe("success");
    });

    it("'En retard' si au moins une facture est overdue (prime sur partiel)", () => {
      const r = computeBillingStatus(
        makeOrder({ invoices: [inv("paid"), inv("overdue")] }),
      );
      expect(r).toEqual({ label: "En retard", color: "warning", title: "Facture(s) en retard" });
    });

    it("'En retard' pour statut uncollectible", () => {
      const r = computeBillingStatus(makeOrder({ invoices: [inv("uncollectible")] }));
      expect(r?.label).toBe("En retard");
      expect(r?.color).toBe("warning");
    });

    it("'Part. payée' si une seule facture payée sur plusieurs, sans overdue", () => {
      const r = computeBillingStatus(
        makeOrder({ invoices: [inv("paid"), inv("pending")] }),
      );
      expect(r).toEqual({ label: "Part. payée", color: "info", title: "Paiement partiel" });
    });

    it("'Facturée' si aucune facture payée et aucune overdue", () => {
      const r = computeBillingStatus(
        makeOrder({ invoices: [inv("pending"), inv("finalized")] }),
      );
      expect(r?.label).toBe("Facturée");
      expect(r?.color).toBe("info");
    });
  });

  describe("sans facture", () => {
    it("'Payée' si payment_status='paid'", () => {
      const r = computeBillingStatus(makeOrder({ payment_status: "paid" }));
      expect(r).toEqual({
        label: "Payée",
        color: "success",
        title: "Paiement enregistré (hors facture)",
      });
    });

    it("null si order_status='draft'", () => {
      expect(computeBillingStatus(makeOrder({ order_status: "draft" }))).toBeNull();
    });

    it("null si order_status='pending'", () => {
      expect(computeBillingStatus(makeOrder({ order_status: "pending" }))).toBeNull();
    });

    it("'À facturer' pour une commande confirmée sans facture ni paiement", () => {
      const r = computeBillingStatus(makeOrder({ order_status: "confirmed" }));
      expect(r).toEqual({ label: "À facturer", color: "warning", title: "Aucune facture émise" });
    });

    it("'À facturer' pour une commande livrée sans facture ni paiement", () => {
      const r = computeBillingStatus(makeOrder({ order_status: "delivered" }));
      expect(r?.label).toBe("À facturer");
    });

    it("gère invoices absent/undefined comme liste vide", () => {
      const r = computeBillingStatus(makeOrder({ invoices: undefined as any }));
      expect(r?.label).toBe("À facturer");
    });
  });

  describe("cohérence overdue vs partially_paid", () => {
    it("payment_status='partially_paid' sans factures → 'À facturer' (le statut brut n'est pas mappé sans facture)", () => {
      const r = computeBillingStatus(
        makeOrder({ payment_status: "partially_paid", order_status: "confirmed" }),
      );
      expect(r?.label).toBe("À facturer");
    });

    it("payment_status='overdue' sans factures → 'À facturer' (dérivation basée sur les factures)", () => {
      const r = computeBillingStatus(
        makeOrder({ payment_status: "overdue", order_status: "confirmed" }),
      );
      expect(r?.label).toBe("À facturer");
    });
  });
});
