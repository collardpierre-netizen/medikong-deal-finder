/**
 * Validation des coordonnées MediKong + vendeur pour le contrat.
 * Miroir client de `supabase/functions/_shared/contract-validation.ts`.
 *
 * À utiliser AVANT toute génération PDF ou envoi d'email pour bloquer
 * en amont. Le serveur applique la même règle (défense en profondeur).
 */

import type {
  ContractMediKongData,
  ContractVendorData,
} from "./mandat-facturation-template";

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bN\/A\b/i,
  /\bxxx+\b/i,
  /\bplaceholder\b/i,
  /\b(à|a) (compl[ée]ter|d[ée]finir|remplir)\b/i,
  /\{\{.*\}\}/,
  /<[^>]+>/,
  /\[.*\]/,
  /\.\.\./,
  /^—+$/,
  /lorem ipsum/i,
  /example\.com/i,
];

const MEDIKONG_REQUIRED: Array<keyof ContractMediKongData> = [
  "legal_form",
  "address",
  "bce",
  "vat",
  "representative_name",
  "representative_role",
  "jurisdiction_city",
];

const VENDOR_REQUIRED: Array<keyof ContractVendorData> = [
  "company_name",
  "representative_name",
  "bce",
  "vat",
];

const FIELD_LABELS: Record<string, string> = {
  legal_form: "Forme juridique",
  address: "Adresse",
  bce: "Numéro BCE",
  vat: "Numéro de TVA",
  representative_name: "Nom du représentant",
  representative_role: "Fonction du représentant",
  jurisdiction_city: "Ville de juridiction",
  company_name: "Raison sociale",
};

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim().length === 0;
}

function looksLikePlaceholder(v: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

export interface ContractValidationIssue {
  scope: "medikong" | "vendor";
  field: string;
  label: string;
  reason: "missing" | "placeholder";
  value?: string;
}

export interface ContractValidationResult {
  valid: boolean;
  issues: ContractValidationIssue[];
}

export function validateContractData(args: {
  medikong?: Partial<ContractMediKongData> | null;
  vendor?: Partial<ContractVendorData> | null;
}): ContractValidationResult {
  const issues: ContractValidationIssue[] = [];

  const medikong = args.medikong ?? {};
  for (const field of MEDIKONG_REQUIRED) {
    const v = (medikong as Record<string, unknown>)[field];
    const label = FIELD_LABELS[field] ?? field;
    if (isBlank(v)) {
      issues.push({ scope: "medikong", field, label, reason: "missing" });
    } else if (looksLikePlaceholder(String(v))) {
      issues.push({ scope: "medikong", field, label, reason: "placeholder", value: String(v) });
    }
  }

  const vendor = args.vendor ?? {};
  for (const field of VENDOR_REQUIRED) {
    const v = (vendor as Record<string, unknown>)[field];
    const label = FIELD_LABELS[field] ?? field;
    if (isBlank(v)) {
      issues.push({ scope: "vendor", field, label, reason: "missing" });
    } else if (looksLikePlaceholder(String(v))) {
      issues.push({ scope: "vendor", field, label, reason: "placeholder", value: String(v) });
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Erreur typée levée quand la validation échoue. Contient les `issues`
 * pour permettre à l'UI d'afficher un message ciblé.
 */
export class ContractValidationError extends Error {
  readonly issues: ContractValidationIssue[];
  constructor(issues: ContractValidationIssue[]) {
    const summary = issues
      .map((i) => `${i.scope}.${i.label} (${i.reason})`)
      .join(", ");
    super(`Coordonnées contractuelles invalides : ${summary}`);
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}
