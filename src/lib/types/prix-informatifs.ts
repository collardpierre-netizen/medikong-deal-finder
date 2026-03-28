export type ProfilAcheteur = "Pharmacie" | "Hopital" | "MRS" | "Infirmier" | "Cabinet" | "Parapharmacie";
export type PaysCode = "BE" | "LU" | "FR" | "NL";
export type PrixSource = "INAMI" | "CBIP" | "Farmacompendium" | "Marches_publics" | "Prix_moyen" | "Manuel";

export interface PrixPublic {
  ttc: number;
  htva: number;
  source: PrixSource;
  dateConstatation: string;
}

export interface PrixProfilPays {
  id: string;
  profil: ProfilAcheteur;
  pays: PaysCode;
  prixHT: number;
  source: PrixSource;
  dateMAJ: string;
  actif: boolean;
}

export interface SavingsResult {
  pct: number;
  abs: number;
  show: boolean;
  refPrice: number;
  refSource: PrixSource;
  refDate: string;
}
