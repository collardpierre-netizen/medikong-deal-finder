// Vendor Dashboard Mock Data

export const catalogProducts = [
  { sku: "MK-GLV-001", name: "Gants Nitrile M x200", cat: "EPI", brand: "Hartmann", manufacturer: "Hartmann", offers: 4, demande: 89, hasMyOffer: true, ean: "4049500123456", cnk: "1234-567", tva: 21, mdr: "I", conditioning: "Boite de 200", stockTotal: 1240, submittedBy: "Pharmamed SA", competitivity: "best" as const },
  { sku: "MK-MSK-012", name: "Masques FFP2 x50", cat: "EPI", brand: "3M", manufacturer: "3M", offers: 7, demande: 76, hasMyOffer: true, ean: "4049500234567", cnk: "2345-678", tva: 21, mdr: "I", conditioning: "Boite de 50", stockTotal: 520, submittedBy: null, competitivity: "above" as const },
  { sku: "MK-OXY-001", name: "Oxymetre de Pouls", cat: "Diagnostic", brand: "Nonin", manufacturer: "Nonin Medical", offers: 3, demande: 94, hasMyOffer: false, ean: "4049500345678", cnk: "3456-789", tva: 6, mdr: "IIa", conditioning: "Unitaire", stockTotal: 45, submittedBy: null, competitivity: null },
  { sku: "MK-SYR-010", name: "Seringues 5ml x100", cat: "Injection", brand: "BD", manufacturer: "Becton Dickinson", offers: 8, demande: 82, hasMyOffer: false, ean: "4049500456789", cnk: "4567-890", tva: 6, mdr: "I", conditioning: "Boite de 100", stockTotal: 2100, submittedBy: null, competitivity: null },
  { sku: "MK-SCP-003", name: "Stethoscope Littmann Classic III", cat: "Diagnostic", brand: "3M Littmann", manufacturer: "3M", offers: 2, demande: 67, hasMyOffer: false, ean: "4049500567890", cnk: "5678-901", tva: 6, mdr: "IIa", conditioning: "Unitaire", stockTotal: 15, submittedBy: null, competitivity: null },
  { sku: "MK-CMP-001", name: "Compresses steriles 10x10 x100", cat: "Pansements", brand: "Urgo", manufacturer: "Urgo Medical", offers: 6, demande: 91, hasMyOffer: false, ean: "4049500678901", cnk: "6789-012", tva: 6, mdr: "I", conditioning: "Boite de 100", stockTotal: 3200, submittedBy: null, competitivity: null },
  { sku: "MK-THR-005", name: "Thermometre Infrarouge Pro", cat: "Diagnostic", brand: "Braun", manufacturer: "Braun Medical", offers: 3, demande: 72, hasMyOffer: true, ean: "4049500789012", cnk: "7890-123", tva: 6, mdr: "IIa", conditioning: "Unitaire", stockTotal: 23, submittedBy: "Pharmamed SA", competitivity: "best" as const },
  { sku: "MK-DSF-003", name: "Desinfectant Surface 5L", cat: "Hygiene", brand: "Anios", manufacturer: "Ecolab", offers: 5, demande: 88, hasMyOffer: true, ean: "4049500890123", cnk: "8901-234", tva: 21, mdr: "N/A", conditioning: "Bidon 5L", stockTotal: 0, submittedBy: "Pharmamed SA", competitivity: "best" as const },
  { sku: "MK-LIT-001", name: "Drap d'examen 50x35 x12", cat: "Consommables", brand: "Hartmann", manufacturer: "Hartmann", offers: 4, demande: 65, hasMyOffer: false, ean: "4049500901234", cnk: "9012-345", tva: 21, mdr: "N/A", conditioning: "Paquet de 12", stockTotal: 890, submittedBy: null, competitivity: null },
  { sku: "MK-GEL-005", name: "Gel Hydroalcoolique 500ml", cat: "Hygiene", brand: "Anios", manufacturer: "Ecolab", offers: 9, demande: 95, hasMyOffer: false, ean: "4049501012345", cnk: "0123-456", tva: 21, mdr: "N/A", conditioning: "Flacon 500ml", stockTotal: 4500, submittedBy: null, competitivity: null },
];

export const catalogChanges = [
  { id: 1, type: "reclassification", icon: "RefreshCw" as const, severity: "amber", message: "Gel Hydroalcoolique 500ml deplace de Hygiene vers Desinfection", date: "il y a 2j", impactsMyOffers: false },
  { id: 2, type: "new_product", icon: "Plus" as const, severity: "blue", message: "Oxymetre Nonin Vantage 3150 ajoute au catalogue", date: "il y a 3j", impactsMyOffers: false },
  { id: 3, type: "cnk_update", icon: "BarChart3" as const, severity: "red", message: "Compresses Urgo ref CNK 6789-012 mise a jour vers 6789-013", date: "il y a 5j", impactsMyOffers: false },
  { id: 4, type: "product_discontinued", icon: "X" as const, severity: "red", message: "Gants Latex poudres retires du catalogue (non-conformite MDR)", date: "il y a 7j", impactsMyOffers: true },
];

export const dashboardAlerts = [
  { id: 1, severity: "red" as const, product: "Desinfectant Surface 5L", message: "Stock epuise - offre desactivee automatiquement", date: "il y a 1h" },
  { id: 2, severity: "amber" as const, product: "Masques FFP2 x50", message: "Prix au-dessus du marche de 12% - perte de Buy Box probable", date: "il y a 3h" },
  { id: 3, severity: "amber" as const, product: "Gants Nitrile M x200", message: "Nouveau concurrent a -5% sur votre prix", date: "il y a 6h" },
];

export const dashboardOrders = [
  { id: "CMD-2026-0891", buyer: "Pharmacie Centrale", buyerType: "Pharmacie" as const, total: 1234.56, status: "pending" as const, date: "28/03/2026", items: 8, age: 2 },
  { id: "CMD-2026-0890", buyer: "Hopital Saint-Pierre", buyerType: "Hopital" as const, total: 4567.89, status: "confirmed" as const, date: "27/03/2026", items: 15, age: 8 },
  { id: "CMD-2026-0889", buyer: "MRS Les Tilleuls", buyerType: "MRS" as const, total: 890.12, status: "shipped" as const, date: "26/03/2026", items: 5, age: 28 },
  { id: "CMD-2026-0888", buyer: "Cabinet Dr. Martin", buyerType: "Cabinet" as const, total: 345.67, status: "delivered" as const, date: "25/03/2026", items: 3, age: 72 },
  { id: "CMD-2026-0887", buyer: "Parapharmacie Bio", buyerType: "Parapharmacie" as const, total: 2100.00, status: "pending" as const, date: "28/03/2026", items: 12, age: 1 },
];

export const dashboardMessages = [
  { id: 1, from: "Pharmacie Centrale", subject: "Delai de livraison CMD-0891", date: "il y a 1h", unread: true },
  { id: 2, from: "Support MediKong", subject: "Votre score vendeur a augmente", date: "il y a 4h", unread: true },
  { id: 3, from: "Hopital Saint-Pierre", subject: "Demande de devis quantite", date: "hier", unread: false },
];

export const pricingCoachSuggestions = [
  { product: "Masques FFP2", action: "Baisser de 2,3%", impact: "+18 cmd/mois", color: "#059669" },
  { product: "Bandes Cohesives", action: "Reduire MOQ de 5 a 3", impact: "+12% conversion", color: "#1B5BDA" },
  { product: "Gants Latex S", action: "Reactiver l'offre", impact: "+340 EUR/mois potentiel", color: "#7C3AED" },
];

export const manufacturers = [
  { id: "hartmann", name: "Hartmann", brands: ["Hartmann","Peha","Zetuvit","Cosmopor","Hydrofilm"] },
  { id: "essity", name: "Essity", brands: ["Tena","Leukoplast","Cutimed","Jobst","Actimove"] },
  { id: "3m", name: "3M", brands: ["3M","3M Littmann","Tegaderm","Micropore","Coban"] },
  { id: "ecolab", name: "Ecolab", brands: ["Anios","Skinman","Incidin","Sekusept"] },
  { id: "bd", name: "Becton Dickinson", brands: ["BD","BD Micro-Fine","BD Plastipak","BD Vacutainer"] },
  { id: "urgo", name: "Urgo Medical", brands: ["Urgo","UrgoStart","UrgoClean","UrgoTul"] },
  { id: "braun", name: "Braun Medical", brands: ["Braun","Introcan","Vasofix","Omnifix"] },
  { id: "nonin", name: "Nonin Medical", brands: ["Nonin","Onyx Vantage"] },
  { id: "coloplast", name: "Coloplast", brands: ["Coloplast","Biatain","SenSura","Comfeel"] },
  { id: "molnlycke", name: "Molnlycke", brands: ["Mepilex","Mepitel","Mepiform","Biogel"] },
];

export const categoryStats = [
  { cat: "EPI", refs: 124, myOffers: 18, demande: 82, concurrence: 5.2 },
  { cat: "Diagnostic", refs: 89, myOffers: 6, demande: 78, concurrence: 3.1 },
  { cat: "Pansements", refs: 156, myOffers: 22, demande: 85, concurrence: 6.4 },
  { cat: "Hygiene", refs: 98, myOffers: 12, demande: 91, concurrence: 7.8 },
  { cat: "Injection", refs: 67, myOffers: 4, demande: 79, concurrence: 4.5 },
  { cat: "Mobilite", refs: 34, myOffers: 2, demande: 45, concurrence: 2.3 },
  { cat: "Consommables", refs: 210, myOffers: 8, demande: 73, concurrence: 5.9 },
  { cat: "Nutrition", refs: 45, myOffers: 0, demande: 68, concurrence: 3.8 },
  { cat: "Incontinence", refs: 78, myOffers: 3, demande: 88, concurrence: 4.1 },
  { cat: "Dermocosmetique", refs: 52, myOffers: 1, demande: 62, concurrence: 6.2 },
];

export const importHistory = [
  { date: "25/03/2026", file: "offres_mars_2026.xlsx", format: "XLS", offres: 45, status: "success" as const, matched: 42, unmatched: 3 },
  { date: "18/03/2026", file: "update_prix.csv", format: "CSV", offres: 12, status: "partial" as const, matched: 10, unmatched: 2 },
  { date: "10/03/2026", file: "catalogue_complet.xlsx", format: "XLS", offres: 189, status: "success" as const, matched: 189, unmatched: 0 },
];
