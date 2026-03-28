import type { PrixPublic, PrixProfilPays } from "../types/prix-informatifs";

// Mock data keyed by product SKU or name for easy lookup
export const mockPrixPublicByProduct: Record<string, PrixPublic> = {
  "Gants Nitrile M x200": { ttc: 16.80, htva: 15.85, source: "CBIP", dateConstatation: "2026-03-15" },
  "Masques FFP2 x50": { ttc: 28.50, htva: 26.89, source: "CBIP", dateConstatation: "2026-03-10" },
  "Thermometre Infrarouge Pro": { ttc: 52.00, htva: 49.06, source: "INAMI", dateConstatation: "2026-02-20" },
  "Desinfectant Surface 5L": { ttc: 28.00, htva: 23.14, source: "Farmacompendium", dateConstatation: "2026-03-01" },
  "Compresses steriles 10x10 x50": { ttc: 15.90, htva: 15.00, source: "Prix_moyen", dateConstatation: "2026-03-05" },
  "Bandes Cohesives 10cm x4m": { ttc: 9.50, htva: 8.96, source: "CBIP", dateConstatation: "2026-03-12" },
  "Seringues 10ml x100": { ttc: 19.50, htva: 18.40, source: "Marches_publics", dateConstatation: "2026-02-28" },
  "Oxymetre portable Vantage": { ttc: 115.00, htva: 108.49, source: "INAMI", dateConstatation: "2026-03-01" },
};

export const mockPrixParProfilByProduct: Record<string, PrixProfilPays[]> = {
  "Gants Nitrile M x200": [
    { id: "pp1", profil: "Pharmacie", pays: "BE", prixHT: 11.50, source: "INAMI", dateMAJ: "2026-03-01", actif: true },
    { id: "pp2", profil: "Pharmacie", pays: "LU", prixHT: 12.20, source: "Manuel", dateMAJ: "2026-02-10", actif: true },
    { id: "pp3", profil: "Hopital", pays: "BE", prixHT: 7.90, source: "Marches_publics", dateMAJ: "2026-01-20", actif: true },
    { id: "pp4", profil: "MRS", pays: "BE", prixHT: 9.80, source: "Prix_moyen", dateMAJ: "2026-02-15", actif: true },
    { id: "pp5", profil: "Infirmier", pays: "BE", prixHT: 13.50, source: "Farmacompendium", dateMAJ: "2026-03-01", actif: true },
    { id: "pp6", profil: "Cabinet", pays: "BE", prixHT: 12.00, source: "Manuel", dateMAJ: "2026-02-28", actif: false },
  ],
  "Masques FFP2 x50": [
    { id: "pp7", profil: "Pharmacie", pays: "BE", prixHT: 22.00, source: "CBIP", dateMAJ: "2026-03-01", actif: true },
    { id: "pp8", profil: "Hopital", pays: "BE", prixHT: 18.50, source: "Marches_publics", dateMAJ: "2026-02-15", actif: true },
    { id: "pp9", profil: "Cabinet", pays: "BE", prixHT: 24.00, source: "Manuel", dateMAJ: "2026-03-10", actif: true },
  ],
  "Thermometre Infrarouge Pro": [
    { id: "pp10", profil: "Pharmacie", pays: "BE", prixHT: 45.00, source: "INAMI", dateMAJ: "2026-02-20", actif: true },
    { id: "pp11", profil: "Hopital", pays: "BE", prixHT: 38.00, source: "Marches_publics", dateMAJ: "2026-01-15", actif: true },
    { id: "pp12", profil: "Cabinet", pays: "BE", prixHT: 44.00, source: "Manuel", dateMAJ: "2026-03-01", actif: true },
  ],
  "Desinfectant Surface 5L": [
    { id: "pp13", profil: "Pharmacie", pays: "BE", prixHT: 19.50, source: "Farmacompendium", dateMAJ: "2026-03-01", actif: true },
    { id: "pp14", profil: "Hopital", pays: "BE", prixHT: 16.80, source: "Marches_publics", dateMAJ: "2026-02-10", actif: true },
    { id: "pp15", profil: "MRS", pays: "BE", prixHT: 18.00, source: "Prix_moyen", dateMAJ: "2026-02-20", actif: true },
  ],
  "Compresses steriles 10x10 x50": [
    { id: "pp16", profil: "Pharmacie", pays: "BE", prixHT: 12.50, source: "CBIP", dateMAJ: "2026-03-05", actif: true },
    { id: "pp17", profil: "Hopital", pays: "BE", prixHT: 10.20, source: "Marches_publics", dateMAJ: "2026-02-28", actif: true },
  ],
  "Bandes Cohesives 10cm x4m": [
    { id: "pp18", profil: "Pharmacie", pays: "BE", prixHT: 7.50, source: "CBIP", dateMAJ: "2026-03-12", actif: true },
    { id: "pp19", profil: "Infirmier", pays: "BE", prixHT: 6.80, source: "Prix_moyen", dateMAJ: "2026-03-01", actif: true },
  ],
  "Seringues 10ml x100": [
    { id: "pp20", profil: "Hopital", pays: "BE", prixHT: 14.00, source: "Marches_publics", dateMAJ: "2026-02-28", actif: true },
    { id: "pp21", profil: "Infirmier", pays: "BE", prixHT: 15.50, source: "Manuel", dateMAJ: "2026-03-01", actif: true },
  ],
  "Oxymetre portable Vantage": [
    { id: "pp22", profil: "Pharmacie", pays: "BE", prixHT: 95.00, source: "INAMI", dateMAJ: "2026-03-01", actif: true },
    { id: "pp23", profil: "Hopital", pays: "BE", prixHT: 82.00, source: "Marches_publics", dateMAJ: "2026-02-15", actif: true },
    { id: "pp24", profil: "Cabinet", pays: "BE", prixHT: 90.00, source: "Manuel", dateMAJ: "2026-03-10", actif: true },
  ],
};
