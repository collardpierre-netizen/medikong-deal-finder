import type { ProfilAcheteur, PaysCode, PrixSource, PrixPublic, PrixProfilPays, SavingsResult } from "../types/prix-informatifs";

export function getPrixRef(
  prixParProfil: PrixProfilPays[] | undefined,
  prixPublic: PrixPublic | undefined,
  profil: ProfilAcheteur,
  pays: PaysCode
): { price: number; source: PrixSource; date: string } | null {
  const exact = prixParProfil?.find(p => p.profil === profil && p.pays === pays && p.actif);
  if (exact) return { price: exact.prixHT, source: exact.source, date: exact.dateMAJ };

  if (pays !== "BE") {
    const fallbackBE = prixParProfil?.find(p => p.profil === profil && p.pays === "BE" && p.actif);
    if (fallbackBE) return { price: fallbackBE.prixHT, source: fallbackBE.source, date: fallbackBE.dateMAJ };
  }

  if (prixPublic?.htva) {
    return { price: prixPublic.htva, source: prixPublic.source, date: prixPublic.dateConstatation };
  }

  return null;
}

export function calcSavings(
  prixRef: number,
  prixMediKong: number,
  source: PrixSource,
  date: string
): SavingsResult {
  const abs = Math.round((prixRef - prixMediKong) * 100) / 100;
  const pct = Math.round((abs / prixRef) * 100);
  return { pct, abs, show: pct >= 5, refPrice: prixRef, refSource: source, refDate: date };
}

export function formatPrixRef(price: number): string {
  return price.toFixed(2).replace(".", ",") + " \u20AC";
}

export const sourceLabels: Record<PrixSource, string> = {
  INAMI: "INAMI",
  CBIP: "CBIP",
  Farmacompendium: "Farmacompendium",
  Marches_publics: "Marches publics",
  Prix_moyen: "Prix moyen",
  Manuel: "Manuel",
};

export const profilLabels: Record<ProfilAcheteur, string> = {
  Pharmacie: "Pharmacie",
  Hopital: "Hopital",
  MRS: "MRS",
  Infirmier: "Infirmier",
  Cabinet: "Cabinet",
  Parapharmacie: "Parapharmacie",
};

export const paysLabels: Record<PaysCode, string> = {
  BE: "Belgique",
  LU: "Luxembourg",
  FR: "France",
  NL: "Pays-Bas",
};
