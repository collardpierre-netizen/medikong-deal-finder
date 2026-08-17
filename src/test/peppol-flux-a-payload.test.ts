import { describe, it, expect } from "vitest";
import {
  buildOrderInvoicePayloadParts,
  buildVendorCopyFalcoMetadata,
  assertPayloadMatchesInvoice,
  canonicalJson,
  MEDIKONG_SELLER,
} from "../../supabase/functions/_shared/peppol-flow.ts";
import {
  normalizeFalcoPeppolIdentifier,
  normalizeFalcoVatNumber,
  resolveFalcoPostalCode,
} from "../../supabase/functions/_shared/falco-peppol.ts";

// Facture réelle existante (order_invoices, type=self_billing) :
// MK-SB-MK-2026-24395-063807 — 13,41 € HT / 2,82 € TVA / 16,23 € TTC, 1 ligne 21 %.
const INVOICE = {
  invoice_number: "MK-SB-MK-2026-24395-063807",
  amount_excl_vat: 13.41,
  vat_amount: 2.8200000000000003,
  amount_incl_vat: 16.23,
  issued_at: "2026-07-15T20:14:52.782Z",
};
const ORDER = { order_number: "MK-2026-24395" };
const VENDOR = {
  id: "063807eb-e087-49f9-bbbc-846e78f70446",
  name: "Newtech LL",
  company_name: "Newtech LL SRL",
  email: "vendor@example.com",
  vat_number: "BE 0777.888.999",
  peppol_id: "0208:be0777888999",
  address_line1: "12 rue du Test 7800",
  city: "Ath",
  postal_code: "7800",
  country_code: "BE",
  mandate_signed_at: "2026-05-01T00:00:00Z",
};
const LINES = [
  {
    quantity: 1,
    unit_price_excl_vat: 13.41,
    vat_rate: 21.0,
    line_total_excl_vat: 13.41,
    line_total_incl_vat: 16.23,
    manual_label: "Produit test",
    products: null,
  },
];

const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const NOTE = "au nom et pour le compte de Newtech LL SRL";

/** Construction inline telle qu'elle existait dans emit-self-billing-invoice avant factorisation. */
function legacyMetadata(parts: ReturnType<typeof buildOrderInvoicePayloadParts>, documentDate: string) {
  const subtotal = 13.41;
  const totalTtc = 16.23;
  return {
    document_type: "sale_invoice",
    document_date: documentDate,
    due_date: documentDate,
    number: INVOICE.invoice_number,
    buyer_reference: ORDER.order_number || INVOICE.invoice_number,
    note: NOTE,
    sender: {
      name: MEDIKONG_SELLER.name,
      vat_number: MEDIKONG_SELLER.vat_number,
      address: { ...MEDIKONG_SELLER.address },
    },
    receiver: {
      name: VENDOR.company_name || VENDOR.name,
      vat_number: normalizeFalcoVatNumber(VENDOR.vat_number),
      peppol_identifier: normalizeFalcoPeppolIdentifier(VENDOR.peppol_id),
      contact: VENDOR.email ? { email: VENDOR.email } : undefined,
      address: {
        line1: VENDOR.address_line1 || "—",
        zip: resolveFalcoPostalCode(VENDOR),
        city: VENDOR.city || undefined,
        country: VENDOR.country_code || "BE",
      },
    },
    currency: "EUR",
    base_amount: round2(subtotal),
    total_amount: round2(totalTtc),
    tax_subtotals: parts.tax_subtotals,
    lines: parts.lines,
    send_peppol: true,
  };
}

describe("Flux A — payload identique avant/après factorisation", () => {
  const parts = buildOrderInvoicePayloadParts(LINES as any[]);
  const documentDate = "2026-08-17";

  it("produit une sérialisation canonique octet pour octet identique", () => {
    const before = canonicalJson(legacyMetadata(parts, documentDate));
    const after = canonicalJson(
      buildVendorCopyFalcoMetadata({
        invoiceNumber: INVOICE.invoice_number,
        documentDate,
        dueDate: documentDate,
        buyerReference: ORDER.order_number || INVOICE.invoice_number,
        note: NOTE,
        vendor: VENDOR,
        baseAmount: 13.41,
        totalAmount: 16.23,
        parts,
      }),
    );
    expect(after).toBe(before);
    expect(new TextEncoder().encode(after)).toEqual(new TextEncoder().encode(before));
  });
});

describe("Contrôle de cohérence des totaux (entiers, tolérance 0)", () => {
  const parts = buildOrderInvoicePayloadParts(LINES as any[]);

  it("valide la facture réelle", () => {
    expect(assertPayloadMatchesInvoice(parts, INVOICE)).toEqual({ ok: true });
  });

  it("rejette un écart de 1 cent avec un message TOTALS_MISMATCH explicite", () => {
    const res = assertPayloadMatchesInvoice(parts, { ...INVOICE, amount_excl_vat: 13.42, amount_incl_vat: 16.24 });
    expect(res.ok).toBe(false);
    expect((res as any).error).toMatch(/^TOTALS_MISMATCH/);
    expect((res as any).error).toContain("delta=");
  });

  it("rejette une TVA incohérente", () => {
    const res = assertPayloadMatchesInvoice(parts, { ...INVOICE, vat_amount: 2.9 });
    expect(res.ok).toBe(false);
    expect((res as any).error).toContain("vat");
  });
});
