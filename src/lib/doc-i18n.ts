// MediKong — Langue des documents imprimables (devis, bon de commande,
// bon de livraison, facture) + traduction automatique du contenu variable.
//
// Les libellés fixes sont traduits ici (FR / NL / EN / DE).
// Le contenu variable (noms de produits, notes, remarques) passe par
// l'edge function `translate-and-cache` : payé 1× puis servi par le cache.

import { supabase } from "@/integrations/supabase/client";

export const DOC_LANGUAGES = ["fr", "nl", "en", "de"] as const;
export type DocLang = (typeof DOC_LANGUAGES)[number];

export const DOC_LANGUAGE_LABELS: Record<DocLang, string> = {
  fr: "Français",
  nl: "Nederlands",
  en: "English",
  de: "Deutsch",
};

const LOCALES: Record<DocLang, string> = {
  fr: "fr-BE",
  nl: "nl-BE",
  en: "en-GB",
  de: "de-BE",
};

export const docLocale = (lang: DocLang): string => LOCALES[lang] ?? "fr-BE";

export const isDocLang = (v: unknown): v is DocLang =>
  typeof v === "string" && (DOC_LANGUAGES as readonly string[]).includes(v);

type Dict = Record<string, string>;

const FR: Dict = {
  // Communs
  date: "Date",
  status: "Statut",
  supplier: "FOURNISSEUR",
  customer: "CLIENT",
  issuer: "ÉMETTEUR",
  vat: "TVA",
  vatNumber: "TVA",
  totalExcl: "Total HTVA",
  vatTotal: "TVA",
  totalIncl: "Total TVAC",
  colArticle: "Article",
  colVendorRef: "Réf. fournisseur",
  colQty: "Qté",
  colUnitPriceExcl: "PU HTVA",
  colVat: "TVA",
  colTotalExcl: "Total HTVA",
  total: "Total",
  none: "—",
  // Devis
  quoteTitle: "MediKong — Devis",
  quoteDocName: "Devis",
  quoteSubject: "Devis MediKong",
  validUntil: "Valable jusqu'au",
  quoteFooter: "MediKong — Devis exprimé en euros, prix HTVA sauf mention contraire.",
  quoteFile: "devis",
  // Bon de commande fournisseur
  vendorOrderTitle: "MediKong — Bon de commande fournisseur",
  vendorOrderDocName: "Bon de commande",
  vendorOrderSubject: "Bon de commande fournisseur MediKong",
  vendorOrderFooter:
    "MediKong — Bon de commande exprimé en euros, prix HTVA sauf mention contraire.",
  vendorOrderFile: "bon-de-commande",
  // Bon de livraison
  dnTitle: "MediKong — Bon de livraison",
  dnDocFinal: "Bon de livraison final",
  dnDocDraft: "Bon de livraison provisoire (brouillon) — sans valeur définitive",
  dnNoNumber: "Sans numéro",
  draft: "BROUILLON",
  cancelled: "ANNULÉ",
  draftFooter:
    "DOCUMENT PROVISOIRE — BROUILLON · Ne pas utiliser comme bon de livraison définitif",
  order: "Commande",
  vatIntra: "N° TVA intracommunautaire",
  partialBadge: "LIVRAISON PARTIELLE — RELIQUAT EN BACK ORDER",
  fullBadge: "LIVRAISON TOTALE",
  carrier: "Transporteur",
  tracking: "Suivi",
  colCnk: "CNK",
  colEan: "EAN",
  colProduct: "Produit",
  colOrdered: "Commandé",
  colDelivered: "Livré",
  colRemaining: "Reliquat",
  dnFooter: "MediKong — Bon de livraison",
  receiverSignature: "Signature du réceptionnaire",
  checklistTitle: "Checklist de réception (à compléter par le client)",
  remarks: "Remarques",
  signedBy: "Réception signée par",
  signedOn: "le",
  eSignNote: "Signature électronique horodatée — enregistrée par MediKong.",
  receiverNameRole: "Nom et fonction du réceptionnaire :",
  signature: "Signature :",
  dnFile: "bon-livraison",
  // Facture
  invoiceCommission: "Facture de commission MediKong",
  invoiceSelfBilling: "Facture au nom et pour le compte du fournisseur",
  invoiceManual: "Facture fournisseur",
  issueDate: "Date d'émission",
  dueDate: "Échéance",
  description: "Description",
  amount: "Montant",
  totalToPay: "Total à payer (TVAC)",
  sepaTitle: "PAIEMENT PAR VIREMENT SEPA",
  beneficiary: "Bénéficiaire",
  iban: "IBAN",
  communication: "Communication",
  legalSelfBilling:
    "Facture émise par MediKong au nom et pour le compte du fournisseur, en vertu du mandat de facturation signé lors de son inscription. Le compte de paiement est celui de MediKong.",
  legalCommission:
    "Facture de commission émise par Balooh SRL (MediKong). Paiement à l'échéance sur le compte indiqué ci-dessus, en mentionnant la communication.",
};

const NL: Dict = {
  date: "Datum",
  status: "Status",
  supplier: "LEVERANCIER",
  customer: "KLANT",
  issuer: "UITGEVER",
  vat: "BTW",
  vatNumber: "BTW",
  totalExcl: "Totaal excl. btw",
  vatTotal: "BTW",
  totalIncl: "Totaal incl. btw",
  colArticle: "Artikel",
  colVendorRef: "Ref. leverancier",
  colQty: "Aantal",
  colUnitPriceExcl: "Eenheidsprijs excl.",
  colVat: "BTW",
  colTotalExcl: "Totaal excl.",
  total: "Totaal",
  none: "—",
  quoteTitle: "MediKong — Prijsaanvraag",
  quoteDocName: "Offerte",
  quoteSubject: "MediKong offerte",
  validUntil: "Geldig tot",
  quoteFooter: "MediKong — Offerte in euro, prijzen excl. btw tenzij anders vermeld.",
  quoteFile: "offerte",
  vendorOrderTitle: "MediKong — Inkooporder leverancier",
  vendorOrderDocName: "Inkooporder",
  vendorOrderSubject: "MediKong inkooporder leverancier",
  vendorOrderFooter:
    "MediKong — Inkooporder in euro, prijzen excl. btw tenzij anders vermeld.",
  vendorOrderFile: "inkooporder",
  dnTitle: "MediKong — Leveringsbon",
  dnDocFinal: "Definitieve leveringsbon",
  dnDocDraft: "Voorlopige leveringsbon (ontwerp) — zonder definitieve waarde",
  dnNoNumber: "Zonder nummer",
  draft: "ONTWERP",
  cancelled: "GEANNULEERD",
  draftFooter:
    "VOORLOPIG DOCUMENT — ONTWERP · Niet gebruiken als definitieve leveringsbon",
  order: "Order",
  vatIntra: "Intracommunautair btw-nummer",
  partialBadge: "GEDEELTELIJKE LEVERING — RESTANT IN BACKORDER",
  fullBadge: "VOLLEDIGE LEVERING",
  carrier: "Vervoerder",
  tracking: "Tracking",
  colCnk: "CNK",
  colEan: "EAN",
  colProduct: "Product",
  colOrdered: "Besteld",
  colDelivered: "Geleverd",
  colRemaining: "Restant",
  dnFooter: "MediKong — Leveringsbon",
  receiverSignature: "Handtekening ontvanger",
  checklistTitle: "Ontvangstchecklist (in te vullen door de klant)",
  remarks: "Opmerkingen",
  signedBy: "Ontvangst ondertekend door",
  signedOn: "op",
  eSignNote: "Elektronische handtekening met tijdstempel — vastgelegd door MediKong.",
  receiverNameRole: "Naam en functie van de ontvanger:",
  signature: "Handtekening:",
  dnFile: "leveringsbon",
  invoiceCommission: "MediKong commissiefactuur",
  invoiceSelfBilling: "Factuur in naam en voor rekening van de leverancier",
  invoiceManual: "Leveranciersfactuur",
  issueDate: "Factuurdatum",
  dueDate: "Vervaldatum",
  description: "Omschrijving",
  amount: "Bedrag",
  totalToPay: "Te betalen totaal (incl. btw)",
  sepaTitle: "BETALING VIA SEPA-OVERSCHRIJVING",
  beneficiary: "Begunstigde",
  iban: "IBAN",
  communication: "Mededeling",
  legalSelfBilling:
    "Factuur uitgereikt door MediKong in naam en voor rekening van de leverancier, op basis van het bij de inschrijving ondertekende facturatiemandaat. De betaalrekening is die van MediKong.",
  legalCommission:
    "Commissiefactuur uitgereikt door Balooh SRL (MediKong). Betaling op de vervaldag op bovenstaande rekening, met vermelding van de mededeling.",
};

const EN: Dict = {
  date: "Date",
  status: "Status",
  supplier: "SUPPLIER",
  customer: "CUSTOMER",
  issuer: "ISSUER",
  vat: "VAT",
  vatNumber: "VAT",
  totalExcl: "Total excl. VAT",
  vatTotal: "VAT",
  totalIncl: "Total incl. VAT",
  colArticle: "Item",
  colVendorRef: "Supplier ref.",
  colQty: "Qty",
  colUnitPriceExcl: "Unit price excl.",
  colVat: "VAT",
  colTotalExcl: "Total excl.",
  total: "Total",
  none: "—",
  quoteTitle: "MediKong — Quotation",
  quoteDocName: "Quotation",
  quoteSubject: "MediKong quotation",
  validUntil: "Valid until",
  quoteFooter: "MediKong — Quotation in euros, prices excl. VAT unless stated otherwise.",
  quoteFile: "quotation",
  vendorOrderTitle: "MediKong — Supplier purchase order",
  vendorOrderDocName: "Purchase order",
  vendorOrderSubject: "MediKong supplier purchase order",
  vendorOrderFooter:
    "MediKong — Purchase order in euros, prices excl. VAT unless stated otherwise.",
  vendorOrderFile: "purchase-order",
  dnTitle: "MediKong — Delivery note",
  dnDocFinal: "Final delivery note",
  dnDocDraft: "Provisional delivery note (draft) — not final",
  dnNoNumber: "No number",
  draft: "DRAFT",
  cancelled: "CANCELLED",
  draftFooter: "PROVISIONAL DOCUMENT — DRAFT · Do not use as a final delivery note",
  order: "Order",
  vatIntra: "Intra-EU VAT number",
  partialBadge: "PARTIAL DELIVERY — REMAINDER ON BACK ORDER",
  fullBadge: "COMPLETE DELIVERY",
  carrier: "Carrier",
  tracking: "Tracking",
  colCnk: "CNK",
  colEan: "EAN",
  colProduct: "Product",
  colOrdered: "Ordered",
  colDelivered: "Delivered",
  colRemaining: "Back order",
  dnFooter: "MediKong — Delivery note",
  receiverSignature: "Recipient signature",
  checklistTitle: "Receipt checklist (to be completed by the customer)",
  remarks: "Remarks",
  signedBy: "Receipt signed by",
  signedOn: "on",
  eSignNote: "Time-stamped electronic signature — recorded by MediKong.",
  receiverNameRole: "Recipient name and role:",
  signature: "Signature:",
  dnFile: "delivery-note",
  invoiceCommission: "MediKong commission invoice",
  invoiceSelfBilling: "Invoice issued in the name and on behalf of the supplier",
  invoiceManual: "Supplier invoice",
  issueDate: "Issue date",
  dueDate: "Due date",
  description: "Description",
  amount: "Amount",
  totalToPay: "Total payable (incl. VAT)",
  sepaTitle: "PAYMENT BY SEPA TRANSFER",
  beneficiary: "Beneficiary",
  iban: "IBAN",
  communication: "Reference",
  legalSelfBilling:
    "Invoice issued by MediKong in the name and on behalf of the supplier, under the self-billing mandate signed at registration. The payment account is MediKong's.",
  legalCommission:
    "Commission invoice issued by Balooh SRL (MediKong). Payment due on the stated date to the account above, quoting the reference.",
};

const DE: Dict = {
  date: "Datum",
  status: "Status",
  supplier: "LIEFERANT",
  customer: "KUNDE",
  issuer: "AUSSTELLER",
  vat: "MwSt.",
  vatNumber: "USt-IdNr.",
  totalExcl: "Summe netto",
  vatTotal: "MwSt.",
  totalIncl: "Summe brutto",
  colArticle: "Artikel",
  colVendorRef: "Lieferanten-Ref.",
  colQty: "Menge",
  colUnitPriceExcl: "EP netto",
  colVat: "MwSt.",
  colTotalExcl: "Summe netto",
  total: "Summe",
  none: "—",
  quoteTitle: "MediKong — Angebot",
  quoteDocName: "Angebot",
  quoteSubject: "MediKong Angebot",
  validUntil: "Gültig bis",
  quoteFooter: "MediKong — Angebot in Euro, Preise netto, sofern nicht anders angegeben.",
  quoteFile: "angebot",
  vendorOrderTitle: "MediKong — Lieferantenbestellung",
  vendorOrderDocName: "Bestellung",
  vendorOrderSubject: "MediKong Lieferantenbestellung",
  vendorOrderFooter:
    "MediKong — Bestellung in Euro, Preise netto, sofern nicht anders angegeben.",
  vendorOrderFile: "bestellung",
  dnTitle: "MediKong — Lieferschein",
  dnDocFinal: "Endgültiger Lieferschein",
  dnDocDraft: "Vorläufiger Lieferschein (Entwurf) — ohne endgültige Gültigkeit",
  dnNoNumber: "Ohne Nummer",
  draft: "ENTWURF",
  cancelled: "STORNIERT",
  draftFooter:
    "VORLÄUFIGES DOKUMENT — ENTWURF · Nicht als endgültigen Lieferschein verwenden",
  order: "Bestellung",
  vatIntra: "Innergemeinschaftliche USt-IdNr.",
  partialBadge: "TEILLIEFERUNG — RESTMENGE IM RÜCKSTAND",
  fullBadge: "VOLLSTÄNDIGE LIEFERUNG",
  carrier: "Spediteur",
  tracking: "Sendungsverfolgung",
  colCnk: "CNK",
  colEan: "EAN",
  colProduct: "Produkt",
  colOrdered: "Bestellt",
  colDelivered: "Geliefert",
  colRemaining: "Rückstand",
  dnFooter: "MediKong — Lieferschein",
  receiverSignature: "Unterschrift des Empfängers",
  checklistTitle: "Wareneingangs-Checkliste (vom Kunden auszufüllen)",
  remarks: "Bemerkungen",
  signedBy: "Empfang unterschrieben von",
  signedOn: "am",
  eSignNote: "Elektronische Signatur mit Zeitstempel — von MediKong erfasst.",
  receiverNameRole: "Name und Funktion des Empfängers:",
  signature: "Unterschrift:",
  dnFile: "lieferschein",
  invoiceCommission: "MediKong Provisionsrechnung",
  invoiceSelfBilling: "Rechnung im Namen und für Rechnung des Lieferanten",
  invoiceManual: "Lieferantenrechnung",
  issueDate: "Rechnungsdatum",
  dueDate: "Fälligkeit",
  description: "Beschreibung",
  amount: "Betrag",
  totalToPay: "Zu zahlender Gesamtbetrag (brutto)",
  sepaTitle: "ZAHLUNG PER SEPA-ÜBERWEISUNG",
  beneficiary: "Empfänger",
  iban: "IBAN",
  communication: "Verwendungszweck",
  legalSelfBilling:
    "Rechnung von MediKong im Namen und für Rechnung des Lieferanten ausgestellt, auf Grundlage des bei der Registrierung unterzeichneten Gutschriftsverfahrens. Zahlungskonto ist das von MediKong.",
  legalCommission:
    "Provisionsrechnung der Balooh SRL (MediKong). Zahlung bei Fälligkeit auf das oben genannte Konto unter Angabe des Verwendungszwecks.",
};

const DICTS: Record<DocLang, Dict> = { fr: FR, nl: NL, en: EN, de: DE };

/** Libellé fixe traduit (repli FR si la clé manque). */
export function docT(lang: DocLang, key: string): string {
  return DICTS[lang]?.[key] ?? FR[key] ?? key;
}

/** Fabrique un traducteur de libellés fixes pour une langue. */
export const docTranslator = (lang: DocLang) => (key: string) => docT(lang, key);

const memo = new Map<string, string>();

/**
 * Traduit du contenu variable (noms de produits, notes, remarques) via
 * l'edge function `translate-and-cache`. En cas d'échec, renvoie l'original :
 * un document sort toujours, même sans traduction.
 */
export async function translateDocTexts(
  texts: (string | null | undefined)[],
  lang: DocLang,
  sourceLang: DocLang = "fr",
): Promise<string[]> {
  const originals = texts.map((t) => (t ?? "").toString());
  if (lang === sourceLang) return originals;

  const pending: string[] = [];
  for (const text of originals) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const key = `${sourceLang}:${lang}:${trimmed}`;
    if (!memo.has(key) && !pending.includes(trimmed)) pending.push(trimmed);
  }

  if (pending.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke("translate-and-cache", {
        body: { texts: pending, targetLang: lang, sourceLang },
      });
      if (!error) {
        const out = (data as { translations?: unknown })?.translations;
        if (Array.isArray(out)) {
          pending.forEach((src, i) => {
            const val = out[i];
            if (typeof val === "string" && val.trim()) {
              memo.set(`${sourceLang}:${lang}:${src}`, val);
            }
          });
        }
      }
    } catch {
      /* traduction indisponible — on garde les textes d'origine */
    }
  }

  return originals.map((text) => {
    const trimmed = text.trim();
    if (!trimmed) return text;
    return memo.get(`${sourceLang}:${lang}:${trimmed}`) ?? text;
  });
}

/** Traduit un seul texte (raccourci). */
export async function translateDocText(
  text: string | null | undefined,
  lang: DocLang,
  sourceLang: DocLang = "fr",
): Promise<string> {
  const [out] = await translateDocTexts([text], lang, sourceLang);
  return out;
}
