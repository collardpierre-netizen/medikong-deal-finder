// Vendor Offers & Orders Mock Data

export const vendorOffers = [
  {
    id: "OFF-001", sku: "MK-GLV-001", name: "Gants Nitrile M x200", cat: "EPI",
    buyBox: true, price: 24.50, port: 4.90, priceLivr: 29.40, commission: 12, net: 21.56,
    stock: 1240, competing: 4, rank: 1, profiles: ["Pharmacie", "Hopital", "MRS"],
    countries: ["BE", "LU"], status: "active" as const, views: 342, conversions: 89,
    moq: 2, tva: 21, ean: "4049500123456", cnk: "1234-567", conditioning: "Boite de 200",
    fulfillmentRate: 98, reviewScore: 4.7, conversionRate: 26,
    lastPriceChange: "22/03/2026", stockAlert: 100, marketAvg: 31.20, marketBest: 28.90,
    priceHistory: [29.40, 29.40, 30.10, 29.40, 29.40, 28.90, 29.40],
    priceLog: [
      { date: "22/03/2026", price: 24.50, priceLivr: 29.40, by: "Manuel", note: "Alignement concurrence" },
      { date: "15/03/2026", price: 25.10, priceLivr: 30.00, by: "Manuel", note: "" },
      { date: "01/03/2026", price: 24.90, priceLivr: 29.80, by: "Import XLS", note: "Import mensuel" },
    ],
    clientRules: [
      { clientId: "Pharmacie Centrale", type: "fixed" as const, priceLivr: 27.50, discount: null, moq: 5, mov: 150, validUntil: "30/06/2026", note: "Contrat annuel" },
      { clientId: "Profil: Hopital", type: "discount" as const, priceLivr: null, discount: 8, moq: 10, mov: 500, validUntil: "31/12/2026", note: "Tarif hopital" },
    ],
  },
  {
    id: "OFF-002", sku: "MK-MSK-012", name: "Masques FFP2 x50", cat: "EPI",
    buyBox: false, price: 18.90, port: 4.90, priceLivr: 23.80, commission: 12, net: 16.63,
    stock: 520, competing: 7, rank: 4, profiles: ["Pharmacie", "Cabinet"],
    countries: ["BE"], status: "active" as const, views: 267, conversions: 42,
    moq: 3, tva: 21, ean: "4049500234567", cnk: "2345-678", conditioning: "Boite de 50",
    fulfillmentRate: 95, reviewScore: 4.3, conversionRate: 15.7,
    lastPriceChange: "18/03/2026", stockAlert: 50, marketAvg: 21.50, marketBest: 19.90,
    priceHistory: [23.80, 24.20, 23.80, 23.80, 24.50, 23.80, 23.80],
    priceLog: [
      { date: "18/03/2026", price: 18.90, priceLivr: 23.80, by: "Manuel", note: "Baisse pour Buy Box" },
    ],
    clientRules: [],
  },
  {
    id: "OFF-003", sku: "MK-THR-005", name: "Thermometre Infrarouge Pro", cat: "Diagnostic",
    buyBox: true, price: 42.00, port: 0, priceLivr: 42.00, commission: 12, net: 36.96,
    stock: 23, competing: 3, rank: 1, profiles: ["Pharmacie", "Hopital", "Cabinet", "MRS"],
    countries: ["BE", "LU", "FR"], status: "active" as const, views: 156, conversions: 34,
    moq: 1, tva: 6, ean: "4049500789012", cnk: "7890-123", conditioning: "Unitaire",
    fulfillmentRate: 100, reviewScore: 4.9, conversionRate: 21.8,
    lastPriceChange: "10/03/2026", stockAlert: 5, marketAvg: 45.00, marketBest: 41.50,
    priceHistory: [42.00, 42.00, 43.50, 42.00, 42.00, 42.00, 42.00],
    priceLog: [
      { date: "10/03/2026", price: 42.00, priceLivr: 42.00, by: "Import XLS", note: "" },
    ],
    clientRules: [],
  },
  {
    id: "OFF-004", sku: "MK-DSF-003", name: "Desinfectant Surface 5L", cat: "Hygiene",
    buyBox: true, price: 15.80, port: 6.50, priceLivr: 22.30, commission: 12, net: 13.90,
    stock: 0, competing: 5, rank: 1, profiles: ["Hopital", "MRS", "Cabinet"],
    countries: ["BE"], status: "rupture" as const, views: 198, conversions: 67,
    moq: 1, tva: 21, ean: "4049500890123", cnk: "8901-234", conditioning: "Bidon 5L",
    fulfillmentRate: 88, reviewScore: 4.5, conversionRate: 33.8,
    lastPriceChange: "20/03/2026", stockAlert: 10, marketAvg: 24.00, marketBest: 21.90,
    priceHistory: [22.30, 22.30, 22.30, 23.00, 22.30, 22.30, 22.30],
    priceLog: [],
    clientRules: [],
  },
  {
    id: "OFF-005", sku: "MK-CMP-002", name: "Compresses steriles 10x10 x50", cat: "Pansements",
    buyBox: false, price: 8.50, port: 4.90, priceLivr: 13.40, commission: 12, net: 7.48,
    stock: 890, competing: 6, rank: 3, profiles: ["Pharmacie"],
    countries: ["BE"], status: "active" as const, views: 89, conversions: 12,
    moq: 5, tva: 6, ean: "4049500678902", cnk: "6789-013", conditioning: "Boite de 50",
    fulfillmentRate: 97, reviewScore: 4.1, conversionRate: 13.5,
    lastPriceChange: "05/03/2026", stockAlert: 50, marketAvg: 12.80, marketBest: 11.90,
    priceHistory: [13.40, 13.40, 13.40, 13.40, 13.40, 13.40, 13.40],
    priceLog: [],
    clientRules: [],
  },
  {
    id: "OFF-006", sku: "MK-BND-001", name: "Bandes Cohesives 10cm x4m", cat: "Pansements",
    buyBox: true, price: 3.20, port: 4.90, priceLivr: 8.10, commission: 12, net: 2.82,
    stock: 2100, competing: 3, rank: 1, profiles: ["Pharmacie", "Infirmier"],
    countries: ["BE", "LU"], status: "active" as const, views: 445, conversions: 134,
    moq: 5, tva: 6, ean: "4049500678950", cnk: "6790-001", conditioning: "Unite",
    fulfillmentRate: 99, reviewScore: 4.6, conversionRate: 30.1,
    lastPriceChange: "12/03/2026", stockAlert: 200, marketAvg: 8.90, marketBest: 7.80,
    priceHistory: [8.10, 8.10, 8.50, 8.10, 8.10, 7.90, 8.10],
    priceLog: [],
    clientRules: [
      { clientId: "Pays: LU", type: "fixed" as const, priceLivr: 9.20, discount: null, moq: 10, mov: 100, validUntil: "31/12/2026", note: "Surcharge LU" },
    ],
  },
  {
    id: "OFF-007", sku: "MK-SYR-011", name: "Seringues 10ml x100", cat: "Injection",
    buyBox: false, price: 12.40, port: 4.90, priceLivr: 17.30, commission: 12, net: 10.91,
    stock: 340, competing: 5, rank: 5, profiles: ["Hopital", "Infirmier"],
    countries: ["BE"], status: "inactive" as const, views: 45, conversions: 3,
    moq: 2, tva: 6, ean: "4049500456790", cnk: "4567-891", conditioning: "Boite de 100",
    fulfillmentRate: 92, reviewScore: 3.8, conversionRate: 6.7,
    lastPriceChange: "01/02/2026", stockAlert: 30, marketAvg: 15.50, marketBest: 14.20,
    priceHistory: [17.30, 17.30, 17.30, 17.30, 17.30, 17.30, 17.30],
    priceLog: [],
    clientRules: [],
  },
  {
    id: "OFF-008", sku: "MK-OXY-002", name: "Oxymetre portable Vantage", cat: "Diagnostic",
    buyBox: false, price: 89.00, port: 0, priceLivr: 89.00, commission: 12, net: 78.32,
    stock: 8, competing: 2, rank: 2, profiles: ["Pharmacie", "Hopital", "Cabinet"],
    countries: ["BE", "LU", "FR"], status: "pending" as const, views: 0, conversions: 0,
    moq: 1, tva: 6, ean: "4049500345679", cnk: "3456-790", conditioning: "Unitaire",
    fulfillmentRate: 0, reviewScore: 0, conversionRate: 0,
    lastPriceChange: "28/03/2026", stockAlert: 2, marketAvg: 95.00, marketBest: 88.00,
    priceHistory: [89.00],
    priceLog: [],
    clientRules: [],
  },
];

export const vendorOrders = [
  {
    id: "CMD-2026-0891", buyer: "Pharmacie Centrale", buyerType: "Pharmacie" as const,
    totalHT: 1028.80, tva: 205.76, totalTTC: 1234.56, status: "pending" as const,
    date: "28/03/2026", dateTs: Date.now() - 2 * 3600 * 1000,
    payTerms: "30 jours fin de mois", delivery: "Bpost",
    contact: { name: "Marie Dupont", phone: "+32 2 123 45 67", email: "marie@pharma-centrale.be" },
    address: { street: "12 rue de la Sante", city: "Bruxelles", postal: "1000", country: "BE" },
    promisedDelivery: "01/04/2026",
    tracking: null,
    lines: [
      { sku: "MK-GLV-001", name: "Gants Nitrile M x200", cat: "EPI", qty: 20, unitPrice: 24.50, lineTotal: 490.00, stockOk: true, qtyAvail: 1240 },
      { sku: "MK-MSK-012", name: "Masques FFP2 x50", cat: "EPI", qty: 15, unitPrice: 18.90, lineTotal: 283.50, stockOk: true, qtyAvail: 520 },
      { sku: "MK-DSF-003", name: "Desinfectant Surface 5L", cat: "Hygiene", qty: 10, unitPrice: 15.80, lineTotal: 158.00, stockOk: false, qtyAvail: 0, backorderEta: "05/04/2026", substitute: { sku: "MK-DSF-004", name: "Desinfectant Anios Premium 5L", price: 16.90 } },
      { sku: "MK-THR-005", name: "Thermometre Infrarouge Pro", cat: "Diagnostic", qty: 2, unitPrice: 42.00, lineTotal: 84.00, stockOk: true, qtyAvail: 23 },
      { sku: "MK-BND-001", name: "Bandes Cohesives 10cm x4m", cat: "Pansements", qty: 4, unitPrice: 3.20, lineTotal: 12.80, stockOk: true, qtyAvail: 2100 },
    ],
  },
  {
    id: "CMD-2026-0890", buyer: "Hopital Saint-Pierre", buyerType: "Hopital" as const,
    totalHT: 3806.58, tva: 761.31, totalTTC: 4567.89, status: "confirmed" as const,
    date: "27/03/2026", dateTs: Date.now() - 8 * 3600 * 1000,
    payTerms: "60 jours", delivery: "DHL",
    contact: { name: "Dr. Van Damme", phone: "+32 2 234 56 78", email: "vd@stpierre.be" },
    address: { street: "322 rue Haute", city: "Bruxelles", postal: "1000", country: "BE" },
    promisedDelivery: "31/03/2026",
    tracking: null,
    lines: [
      { sku: "MK-GLV-001", name: "Gants Nitrile M x200", cat: "EPI", qty: 100, unitPrice: 24.50, lineTotal: 2450.00, stockOk: true, qtyAvail: 1240 },
      { sku: "MK-THR-005", name: "Thermometre Infrarouge Pro", cat: "Diagnostic", qty: 10, unitPrice: 42.00, lineTotal: 420.00, stockOk: true, qtyAvail: 23 },
      { sku: "MK-CMP-002", name: "Compresses steriles 10x10 x50", cat: "Pansements", qty: 50, unitPrice: 8.50, lineTotal: 425.00, stockOk: true, qtyAvail: 890 },
    ],
  },
  {
    id: "CMD-2026-0889", buyer: "MRS Les Tilleuls", buyerType: "MRS" as const,
    totalHT: 741.77, tva: 148.35, totalTTC: 890.12, status: "shipped" as const,
    date: "26/03/2026", dateTs: Date.now() - 28 * 3600 * 1000,
    payTerms: "30 jours", delivery: "Bpost",
    contact: { name: "Sophie Lemaire", phone: "+32 71 123 456", email: "s.lemaire@tilleuls.be" },
    address: { street: "45 avenue des Tilleuls", city: "Charleroi", postal: "6000", country: "BE" },
    promisedDelivery: "29/03/2026",
    tracking: { carrier: "Bpost", number: "3SBELG0123456789", url: "https://track.bpost.cloud/btr/web/#/search?itemCode=3SBELG0123456789" },
    lines: [
      { sku: "MK-DSF-003", name: "Desinfectant Surface 5L", cat: "Hygiene", qty: 20, unitPrice: 15.80, lineTotal: 316.00, stockOk: true, qtyAvail: 20 },
      { sku: "MK-BND-001", name: "Bandes Cohesives 10cm x4m", cat: "Pansements", qty: 30, unitPrice: 3.20, lineTotal: 96.00, stockOk: true, qtyAvail: 2100 },
    ],
  },
  {
    id: "CMD-2026-0888", buyer: "Cabinet Dr. Martin", buyerType: "Cabinet" as const,
    totalHT: 287.97, tva: 57.70, totalTTC: 345.67, status: "delivered" as const,
    date: "25/03/2026", dateTs: Date.now() - 72 * 3600 * 1000,
    payTerms: "Paiement immediat", delivery: "TNT",
    contact: { name: "Dr. Martin", phone: "+32 4 567 89 01", email: "dr.martin@cabinet.be" },
    address: { street: "8 place du Marche", city: "Liege", postal: "4000", country: "BE" },
    promisedDelivery: "27/03/2026",
    tracking: { carrier: "TNT", number: "GD123456789BE", url: "#" },
    lines: [
      { sku: "MK-THR-005", name: "Thermometre Infrarouge Pro", cat: "Diagnostic", qty: 3, unitPrice: 42.00, lineTotal: 126.00, stockOk: true, qtyAvail: 23 },
      { sku: "MK-MSK-012", name: "Masques FFP2 x50", cat: "EPI", qty: 5, unitPrice: 18.90, lineTotal: 94.50, stockOk: true, qtyAvail: 520 },
    ],
  },
  {
    id: "CMD-2026-0887", buyer: "Parapharmacie Bio", buyerType: "Parapharmacie" as const,
    totalHT: 1750.00, tva: 350.00, totalTTC: 2100.00, status: "pending" as const,
    date: "28/03/2026", dateTs: Date.now() - 1 * 3600 * 1000,
    payTerms: "30 jours", delivery: "GLS",
    contact: { name: "Luc Petit", phone: "+32 9 876 54 32", email: "luc@para-bio.be" },
    address: { street: "67 chaussee de Waterloo", city: "Uccle", postal: "1180", country: "BE" },
    promisedDelivery: "02/04/2026",
    tracking: null,
    lines: [
      { sku: "MK-GLV-001", name: "Gants Nitrile M x200", cat: "EPI", qty: 50, unitPrice: 24.50, lineTotal: 1225.00, stockOk: true, qtyAvail: 1240 },
      { sku: "MK-CMP-002", name: "Compresses steriles 10x10 x50", cat: "Pansements", qty: 30, unitPrice: 8.50, lineTotal: 255.00, stockOk: true, qtyAvail: 890 },
    ],
  },
  {
    id: "CMD-2026-0886", buyer: "Pharmacie du Parc", buyerType: "Pharmacie" as const,
    totalHT: 560.00, tva: 33.60, totalTTC: 593.60, status: "shipped" as const,
    date: "24/03/2026", dateTs: Date.now() - 96 * 3600 * 1000,
    payTerms: "30 jours fin de mois", delivery: "DHL",
    contact: { name: "Anne Claes", phone: "+32 2 345 67 89", email: "anne@pharmaparc.be" },
    address: { street: "5 avenue Louise", city: "Bruxelles", postal: "1050", country: "BE" },
    promisedDelivery: "27/03/2026",
    tracking: { carrier: "DHL", number: "JD014600123456789012", url: "#" },
    lines: [
      { sku: "MK-OXY-002", name: "Oxymetre portable Vantage", cat: "Diagnostic", qty: 5, unitPrice: 89.00, lineTotal: 445.00, stockOk: true, qtyAvail: 8 },
      { sku: "MK-BND-001", name: "Bandes Cohesives 10cm x4m", cat: "Pansements", qty: 20, unitPrice: 3.20, lineTotal: 64.00, stockOk: true, qtyAvail: 2100 },
    ],
  },
  {
    id: "CMD-2026-0885", buyer: "Hopital Erasme", buyerType: "Hopital" as const,
    totalHT: 2890.00, tva: 578.00, totalTTC: 3468.00, status: "dispute" as const,
    date: "20/03/2026", dateTs: Date.now() - 192 * 3600 * 1000,
    payTerms: "60 jours", delivery: "Bpost",
    contact: { name: "Dr. Janssen", phone: "+32 2 555 12 34", email: "janssen@erasme.be" },
    address: { street: "808 route de Lennik", city: "Anderlecht", postal: "1070", country: "BE" },
    promisedDelivery: "23/03/2026",
    tracking: { carrier: "Bpost", number: "3SBELG9876543210", url: "#" },
    lines: [
      { sku: "MK-GLV-001", name: "Gants Nitrile M x200", cat: "EPI", qty: 80, unitPrice: 24.50, lineTotal: 1960.00, stockOk: true, qtyAvail: 1240 },
      { sku: "MK-MSK-012", name: "Masques FFP2 x50", cat: "EPI", qty: 30, unitPrice: 18.90, lineTotal: 567.00, stockOk: true, qtyAvail: 520 },
      { sku: "MK-THR-005", name: "Thermometre Infrarouge Pro", cat: "Diagnostic", qty: 5, unitPrice: 42.00, lineTotal: 210.00, stockOk: true, qtyAvail: 23 },
    ],
  },
];

export function orderAge(dateTs: number) {
  const hours = Math.max(0, Math.floor((Date.now() - dateTs) / (3600 * 1000)));
  if (hours < 4) return { label: `${hours}h`, color: "#059669", urgency: "ok" as const };
  if (hours < 12) return { label: `${hours}h`, color: "#1B5BDA", urgency: "normal" as const };
  if (hours < 24) return { label: `${hours}h`, color: "#F59E0B", urgency: "attention" as const };
  if (hours < 48) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return { label: `${days}j ${rem}h`, color: "#F59E0B", urgency: "attention" as const };
  }
  const days = Math.floor(hours / 24);
  return { label: `${days}j`, color: "#EF4343", urgency: "urgent" as const };
}
