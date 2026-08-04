// Helpers d'affichage du module Apporteurs d'affaires.
// Tous les montants serveur sont en cents HTVA.

export function fmtCents(cents: number | null | undefined): string {
  const v = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(v);
}

export function fmtBp(bp: number | null | undefined): string {
  const v = (Number(bp) || 0) / 100;
  return `${new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 2 }).format(v)} %`;
}

export function fmtRatio(ratio: number | null | undefined): string {
  const v = (Number(ratio) || 0) * 100;
  return `${new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 1 }).format(v)} %`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

export type AffiliateRule = {
  base_rate_bp: number;
  margin_guard_threshold_bp: number;
  margin_rate_bp: number;
  attribution_months: number;
  validation_delay_days: number;
  payout_threshold_cents: number;
  self_purchase_allowed?: boolean;
  monthly_cap_cents?: number | null;
  scope?: string;
  version?: number;
};

/** Texte "Comment je gagne", toujours dérivé de la règle active (jamais codé en dur). */
export function howIEarnText(rule: AffiliateRule | null | undefined): string[] {
  if (!rule) return [];
  return [
    `Vous gagnez ${fmtBp(rule.base_rate_bp)} du montant HTVA de chaque vente réalisée par vos clients.`,
    `Si cette commission dépasse ${fmtBp(rule.margin_guard_threshold_bp)} de la marge de MediKong sur la commande, elle devient ${fmtBp(rule.margin_rate_bp)} de cette marge.`,
    `Vos clients vous sont attribués pendant ${rule.attribution_months} mois après leur première commande.`,
    `Chaque commission est validée ${rule.validation_delay_days} jours après la commande, puis payée mensuellement dès ${fmtCents(rule.payout_threshold_cents)} de solde validé.`,
  ];
}

export const COMMISSION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "En cours de validation", className: "bg-amber-100 text-amber-800" },
  on_hold: { label: "En cours de vérification", className: "bg-orange-100 text-orange-800" },
  validated: { label: "Validée", className: "bg-blue-100 text-blue-800" },
  invoiced: { label: "Facturée", className: "bg-indigo-100 text-indigo-800" },
  paid: { label: "Payée", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground" },
};

export const AFFILIATE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  invited: { label: "Invité", className: "bg-amber-100 text-amber-800" },
  active: { label: "Actif", className: "bg-emerald-100 text-emerald-800" },
  suspended: { label: "Suspendu", className: "bg-orange-100 text-orange-800" },
  terminated: { label: "Résilié", className: "bg-muted text-muted-foreground" },
};

export const VAT_MODE_LABELS: Record<string, string> = {
  none: "Aucune TVA",
  vat_21: "TVA 21 %",
  reverse_charge: "Autoliquidation (art. 21 §2)",
};

export const LANDING_PATHS: Array<{ value: string; label: string }> = [
  { value: "/", label: "Accueil" },
  { value: "/catalogue", label: "Catalogue" },
  { value: "/promotions", label: "Promotions" },
  { value: "/economies", label: "Calcul d'économies" },
  { value: "/pro", label: "Espace pro" },
  { value: "/professionnels", label: "Professionnels" },
  { value: "/pharmacies", label: "Pharmacies" },
  { value: "/sourcing", label: "Sourcing" },
  { value: "/onboarding", label: "Inscription" },
];

export type CalcDetails = {
  computable?: boolean;
  order_total_ht_cents?: number;
  net_margin_cents?: number;
  base_rate_bp?: number;
  margin_guard_threshold_bp?: number;
  margin_rate_bp?: number;
  base_amount_cents?: number;
  guard_amount_cents?: number;
  margin_guard_hit?: boolean;
  commission_cents?: number;
  reason?: string;
  manual_resolution?: {
    justification?: string;
    resolved_at?: string;
    net_margin_cents?: number;
  };
};

/** Explication en clair d'un calcul de commission (partagée admin / apporteur). */
export function explainCalc(d: CalcDetails | null | undefined, opts?: { internal?: boolean }): string[] {
  if (!d) return ["Détail de calcul indisponible."];
  const out: string[] = [];
  if (d.computable === false) {
    out.push("Marge MediKong non calculable sur cette commande : commission en cours de vérification.");
    return out;
  }
  out.push(
    `Base : ${fmtBp(d.base_rate_bp)} de ${fmtCents(d.order_total_ht_cents)} HTVA = ${fmtCents(d.base_amount_cents)}.`,
  );
  if (opts?.internal) {
    out.push(`Marge nette MediKong retenue : ${fmtCents(d.net_margin_cents)}.`);
  }
  out.push(
    `Plafond de garde : ${fmtBp(d.margin_guard_threshold_bp)} de la marge MediKong = ${fmtCents(d.guard_amount_cents)}.`,
  );
  if (d.margin_guard_hit) {
    out.push(
      `La base dépasse ce plafond : commission ajustée à ${fmtBp(d.margin_rate_bp)} de la marge MediKong sur cette commande.`,
    );
  } else {
    out.push("La base reste sous le plafond : c'est elle qui s'applique.");
  }
  out.push(`Commission retenue : ${fmtCents(d.commission_cents)}.`);
  if (opts?.internal && d.manual_resolution?.justification) {
    out.push(`Résolution manuelle : « ${d.manual_resolution.justification} » (${fmtDate(d.manual_resolution.resolved_at)}).`);
  }
  return out;
}
