// Intelligence, Alerts, Tenders, Analytics Mock Data

export const opportunities = [
  { sku: "MK-OXY-001", name: "Oxymetre de Pouls", cat: "Diagnostic", brand: "Nonin", offers: 3, demand: 94, avgPrice: 45.90, margin: "~32%", match: "Votre categorie" },
  { sku: "MK-SYR-010", name: "Seringues 5ml x100", cat: "Injection", brand: "BD", offers: 8, demand: 82, avgPrice: 12.30, margin: "~28%", match: "Marque distribuee" },
  { sku: "MK-SCP-003", name: "Stethoscope Littmann Classic III", cat: "Diagnostic", brand: "3M Littmann", offers: 2, demand: 67, avgPrice: 89.00, margin: "~25%", match: "Faible concurrence" },
  { sku: "MK-CMP-001", name: "Compresses steriles 10x10 x100", cat: "Pansements", brand: "Urgo", offers: 6, demand: 91, avgPrice: 8.50, margin: "~35%", match: "Fort volume" },
  { sku: "MK-GEL-005", name: "Gel Hydroalcoolique 500ml", cat: "Hygiene", brand: "Anios", offers: 9, demand: 95, avgPrice: 6.90, margin: "~40%", match: "Top demande" },
];

export const alertsData = [
  { id: 1, severity: "red" as const, product: "Desinfectant Surface 5L", message: "Stock a 0 - offre desactivee automatiquement", rule: "Stock critique", date: "il y a 1h", read: false },
  { id: 2, severity: "red" as const, product: "Masques FFP2 x50", message: "Buy Box perdue - nouveau concurrent a 19,90 EUR", rule: "Buy Box perdue", date: "il y a 3h", read: false },
  { id: 3, severity: "amber" as const, product: "Gants Nitrile M x200", message: "Nouveau concurrent a -5% sur votre prix", rule: "Prix concurrent", date: "il y a 6h", read: false },
  { id: 4, severity: "amber" as const, product: "Seringues 10ml x100", message: "Taux de conversion en chute : 6,7% (-8 pts vs mois dernier)", rule: "Conversion en chute", date: "il y a 12h", read: true },
  { id: 5, severity: "blue" as const, product: "Thermometre Infrarouge Pro", message: "Stock bas : 23 unites (seuil : 5)", rule: "Stock critique", date: "il y a 1j", read: true },
  { id: 6, severity: "blue" as const, product: "Bandes Cohesives 10cm", message: "Votre prix est desormais le meilleur du marche", rule: "Prix concurrent", date: "il y a 2j", read: true },
];

export const alertRules = [
  { id: 1, name: "Stock critique", product: "Tous mes produits", condition: "Stock < seuil alerte", status: "active" as const, triggers: 12, lastTriggered: "il y a 1h" },
  { id: 2, name: "Buy Box perdue", product: "Tous mes produits", condition: "Buy Box = false (etait true)", status: "active" as const, triggers: 3, lastTriggered: "il y a 3h" },
  { id: 3, name: "Prix concurrent", product: "Tous mes produits", condition: "Concurrent a -5% ou moins", status: "active" as const, triggers: 8, lastTriggered: "il y a 6h" },
  { id: 4, name: "Conversion en chute", product: "Offres actives", condition: "Taux conversion -5 pts vs M-1", status: "paused" as const, triggers: 2, lastTriggered: "il y a 12h" },
];

export const tenders = [
  { id: "AO-2026-014", title: "Fourniture EPI - Hopital Erasme", buyer: "Hopital Erasme", buyerType: "Hopital" as const, deadline: "15/04/2026", budget: "12 000 - 18 000 EUR", items: 8, status: "open" as const, matchScore: 92 },
  { id: "AO-2026-013", title: "Consommables medicaux - MRS Armonea", buyer: "Groupe Armonea (12 MRS)", buyerType: "MRS" as const, deadline: "08/04/2026", budget: "25 000 - 35 000 EUR", items: 22, status: "open" as const, matchScore: 78 },
  { id: "AO-2026-012", title: "Materiel diagnostic - Cabinet Janssen", buyer: "Cabinet Dr. Janssen", buyerType: "Cabinet" as const, deadline: "01/04/2026", budget: "3 500 - 5 000 EUR", items: 5, status: "submitted" as const, matchScore: 85 },
  { id: "AO-2026-011", title: "Renouvellement stock hygiene", buyer: "Pharmacie Centrale", buyerType: "Pharmacie" as const, deadline: "20/03/2026", budget: "4 000 EUR", items: 12, status: "won" as const, matchScore: 88 },
  { id: "AO-2026-010", title: "Fauteuils roulants annuel", buyer: "Hopital St-Luc", buyerType: "Hopital" as const, deadline: "10/03/2026", budget: "15 000 - 20 000 EUR", items: 3, status: "lost" as const, matchScore: 72 },
];

export const quotationRequests = [
  { id: "RFQ-2026-042", product: "Gants Nitrile M x200", productSku: "MK-GLV-001", buyer: "Pharmacie du Parc", buyerType: "Pharmacie" as const, qty: 500, targetPrice: 17.50, deadline: "02/04/2026", status: "pending" as const, message: "Commande recurrente mensuelle possible si prix competitif", date: "26/03/2026", via: "fiche_produit" as const },
  { id: "RFQ-2026-041", product: "Desinfectant Surface 5L", productSku: "MK-DSF-003", buyer: "Hopital Saint-Jean", buyerType: "Hopital" as const, qty: 200, targetPrice: 18.00, deadline: "01/04/2026", status: "pending" as const, message: "Besoin urgent - nous avons un appel d'offres interne", date: "27/03/2026", via: "fiche_vendeur" as const },
  { id: "RFQ-2026-040", product: "Masques FFP2 x50", productSku: "MK-MSK-012", buyer: "MRS Les Tilleuls", buyerType: "MRS" as const, qty: 2000, targetPrice: 25.00, deadline: "10/04/2026", status: "replied" as const, message: "Fourniture reguliere prevue", date: "25/03/2026", via: "fiche_produit" as const },
  { id: "RFQ-2026-039", product: "Thermometre Infrarouge Pro", productSku: "MK-THR-005", buyer: "Cabinet Medical Janssen", buyerType: "Cabinet" as const, qty: 50, targetPrice: 40.00, deadline: "05/04/2026", status: "pending" as const, message: "Interet pour achat groupe avec autre cabinet", date: "24/03/2026", via: "fiche_vendeur" as const },
  { id: "RFQ-2026-038", product: "Fauteuil Roulant Standard", productSku: "MK-WHL-001", buyer: "Pharmacie Centrale Bruxelles", buyerType: "Pharmacie" as const, qty: 10, targetPrice: 280.00, deadline: "31/03/2026", status: "replied" as const, message: "Evaluation pour notre section materiel medical", date: "23/03/2026", via: "fiche_produit" as const },
];

export const analyticsData = {
  caMonthly: [
    { month: "Oct", value: 32400 },
    { month: "Nov", value: 38200 },
    { month: "Dec", value: 41500 },
    { month: "Jan", value: 35800 },
    { month: "Fev", value: 39600 },
    { month: "Mar", value: 45200 },
  ],
  conversionBuyBox: [
    { month: "Oct", conversion: 22, buyBox: 68 },
    { month: "Nov", conversion: 24, buyBox: 70 },
    { month: "Dec", conversion: 26, buyBox: 72 },
    { month: "Jan", conversion: 25, buyBox: 69 },
    { month: "Fev", conversion: 27, buyBox: 71 },
    { month: "Mar", conversion: 28, buyBox: 72 },
  ],
  funnel: [
    { step: "Impressions", value: 3850 },
    { step: "Clics", value: 1020, rate: 26.4 },
    { step: "Panier", value: 290, rate: 28.4 },
    { step: "Commande", value: 234, rate: 80.7 },
    { step: "Livree", value: 220, rate: 94.0 },
  ],
  topProducts: [
    { name: "Gants Nitrile M x200", ca: 12040, orders: 89, conversion: 26, perf: 95 },
    { name: "Desinfectant Surface 5L", ca: 8920, orders: 67, conversion: 34, perf: 88 },
    { name: "Bandes Cohesives 10cm", ca: 6780, orders: 134, conversion: 30, perf: 82 },
    { name: "Thermometre Infrarouge Pro", ca: 5460, orders: 34, conversion: 22, perf: 75 },
    { name: "Masques FFP2 x50", ca: 4200, orders: 42, conversion: 16, perf: 62 },
  ],
  regions: [
    { name: "Flandre", pct: 38, revenue: 17176, orders: 89 },
    { name: "Bruxelles", pct: 28, revenue: 12656, orders: 66 },
    { name: "Wallonie", pct: 22, revenue: 9944, orders: 51 },
    { name: "Luxembourg", pct: 12, revenue: 5424, orders: 28 },
  ],
  vsMoyenne: [
    { label: "Conversion", yours: 28, avg: 18, unit: "%" },
    { label: "Buy Box", yours: 72, avg: 64, unit: "%" },
    { label: "Taux litige", yours: 1.2, avg: 2.1, unit: "%", lowerBetter: true },
    { label: "Fulfillment", yours: 98, avg: 92, unit: "%" },
  ],
  profileDistribution: [
    { profile: "Pharmacie", pct: 42 },
    { profile: "Hopital", pct: 28 },
    { profile: "MRS", pct: 15 },
    { profile: "Infirmier", pct: 9 },
    { profile: "Cabinet", pct: 6 },
  ],
};
