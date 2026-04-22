/**
 * Validation côté serveur des coordonnées MediKong pour la convention
 * de mandat de facturation. Toute valeur manquante, vide, ou contenant
 * un placeholder doit bloquer l'envoi (contrat ou email).
 *
 * Cette validation s'applique aussi aux données vendeur critiques pour
 * garantir la valeur juridique du mandat (TVA / BCE manquants → bloquer).
 */

export interface ContractMediKongData {
  legal_form?: string | null;
  address?: string | null;
  bce?: string | null;
  vat?: string | null;
  representative_name?: string | null;
  representative_role?: string | null;
  jurisdiction_city?: string | null;
}

export interface ContractVendorData {
  company_name?: string | null;
  representative_name?: string | null;
  bce?: string | null;
  vat?: string | null;
}

/** Patterns suspects révélant un placeholder non remplacé. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bN\/A\b/i,
  /\bxxx+\b/i,
  /\bplaceholder\b/i,
  /\b(à|a) (compl[ée]ter|d[ée]finir|remplir)\b/i,
  /\{\{.*\}\}/, // moustaches non remplacées
  /<[^>]+>/, // chevrons type <NOM>
  /\[.*\]/, // crochets type [VENDEUR]
  /\.\.\./, // ellipses
  /^—+$/, // tiret seul
  /lorem ipsum/i,
  /example\.com/i,
];

const MEDIKONG_REQUIRED_FIELDS: Array<keyof ContractMediKongData> = [
  "legal_form",
  "address",
  "bce",
  "vat",
  "representative_name",
  "representative_role",
  "jurisdiction_city",
];

const VENDOR_REQUIRED_FIELDS: Array<keyof ContractVendorData> = [
  "company_name",
  "representative_name",
  "bce",
  "vat",
];

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim().length === 0;
}

function looksLikePlaceholder(v: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

export interface ContractValidationIssue {
  scope: "medikong" | "vendor";
  field: string;
  reason: "missing" | "placeholder";
  value?: string;
}

export interface ContractValidationResult {
  valid: boolean;
  issues: ContractValidationIssue[];
}

/**
 * Valide les coordonnées MediKong + vendeur passées dans `templateData`
 * pour les templates liés au contrat. Retourne la liste des champs invalides.
 */
export function validateContractTemplateData(templateData: {
  medikong?: ContractMediKongData | null;
  vendor?: ContractVendorData | null;
}): ContractValidationResult {
  const issues: ContractValidationIssue[] = [];

  const medikong = templateData.medikong ?? {};
  for (const field of MEDIKONG_REQUIRED_FIELDS) {
    const value = medikong[field];
    if (isBlank(value)) {
      issues.push({ scope: "medikong", field, reason: "missing" });
    } else if (looksLikePlaceholder(String(value))) {
      issues.push({ scope: "medikong", field, reason: "placeholder", value: String(value) });
    }
  }

  const vendor = templateData.vendor ?? {};
  for (const field of VENDOR_REQUIRED_FIELDS) {
    const value = vendor[field];
    if (isBlank(value)) {
      issues.push({ scope: "vendor", field, reason: "missing" });
    } else if (looksLikePlaceholder(String(value))) {
      issues.push({ scope: "vendor", field, reason: "placeholder", value: String(value) });
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Liste blanche des templates qui transportent des données contractuelles. */
export const CONTRACT_TEMPLATE_NAMES = new Set([
  "vendor-contract-signed",
  "vendor-contract-submitted",
  "vendor-contract-reminder",
  "admin-contract-notification",
]);

export function isContractTemplate(templateName: string): boolean {
  return CONTRACT_TEMPLATE_NAMES.has(templateName);
}
