// Shared diagnostic helpers for sync-* edge functions.
//
// Goal: when a row, document, or upsert fails, we want to know IMMEDIATELY:
//  - which field is missing or malformed
//  - what type was expected vs what was received
//  - a sample of the offending value (truncated for log safety)
//
// All functions are pure and side-effect free except `logFieldIssues` which
// writes to console.warn / console.error. They never throw.

export type ExpectedType =
  | "string"
  | "non-empty string"
  | "number"
  | "positive number"
  | "integer"
  | "boolean"
  | "uuid"
  | "url"
  | "iso-date"
  | "array"
  | "object"
  | "string[]"
  | "enum";

export interface FieldSpec {
  field: string;
  expected: ExpectedType;
  required?: boolean;
  enumValues?: readonly string[];
  /** Optional context (e.g. "from Qogita CSV column #4 'Brand'") */
  hint?: string;
}

export interface FieldIssue {
  field: string;
  expected: ExpectedType;
  received_type: string;
  received_sample: string;
  reason: string;
  hint?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function describeType(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return `array[${v.length}]`;
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return `object{${keys.slice(0, 5).join(",")}${keys.length > 5 ? ",…" : ""}}`;
  }
  return typeof v;
}

export function sampleValue(v: unknown, max = 120): string {
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") {
      const s = v.length > max ? `${v.slice(0, max)}…(${v.length} chars)` : v;
      return JSON.stringify(s);
    }
    const json = JSON.stringify(v);
    if (json && json.length > max) return `${json.slice(0, max)}…(${json.length} chars)`;
    return json ?? String(v);
  } catch {
    return `<unserializable ${typeof v}>`;
  }
}

function checkOne(value: unknown, spec: FieldSpec): FieldIssue | null {
  const received = describeType(value);
  const sample = sampleValue(value);
  const baseReason = (reason: string): FieldIssue => ({
    field: spec.field,
    expected: spec.expected,
    received_type: received,
    received_sample: sample,
    reason,
    hint: spec.hint,
  });

  const missing = value === null || value === undefined || value === "";
  if (missing) {
    if (spec.required) return baseReason("missing/empty (required)");
    return null;
  }

  switch (spec.expected) {
    case "string":
      if (typeof value !== "string") return baseReason("not a string");
      return null;
    case "non-empty string":
      if (typeof value !== "string" || value.trim() === "") return baseReason("empty or not a string");
      return null;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return baseReason("not a finite number");
      return null;
    case "positive number":
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return baseReason("not a positive finite number");
      return null;
    case "integer":
      if (!Number.isInteger(value)) return baseReason("not an integer");
      return null;
    case "boolean":
      if (typeof value !== "boolean") return baseReason("not a boolean");
      return null;
    case "uuid":
      if (typeof value !== "string" || !UUID_RE.test(value)) return baseReason("not a UUID");
      return null;
    case "url":
      if (typeof value !== "string") return baseReason("not a string URL");
      try { new URL(value); return null; } catch { return baseReason("invalid URL"); }
    case "iso-date":
      if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return baseReason("not an ISO 8601 date");
      return null;
    case "array":
      if (!Array.isArray(value)) return baseReason("not an array");
      return null;
    case "string[]":
      if (!Array.isArray(value)) return baseReason("not an array");
      if (!value.every((x) => typeof x === "string")) return baseReason("array contains non-string element");
      return null;
    case "object":
      if (value === null || typeof value !== "object" || Array.isArray(value)) return baseReason("not a plain object");
      return null;
    case "enum":
      if (!spec.enumValues?.includes(value as string)) {
        return baseReason(`value not in enum [${spec.enumValues?.join(", ")}]`);
      }
      return null;
    default:
      return null;
  }
}

/** Validate a single record against a list of field specs. Returns 0 issues if all good. */
export function validateRecord(
  record: Record<string, unknown> | null | undefined,
  specs: FieldSpec[],
): FieldIssue[] {
  if (!record || typeof record !== "object") {
    return [{
      field: "<root>",
      expected: "object",
      received_type: describeType(record),
      received_sample: sampleValue(record),
      reason: "record is not an object",
    }];
  }
  const issues: FieldIssue[] = [];
  for (const spec of specs) {
    const issue = checkOne(record[spec.field], spec);
    if (issue) issues.push(issue);
  }
  return issues;
}

/** Pretty-print field issues to console. Caps how many bad records are shown to avoid log floods. */
export function logFieldIssues(
  scope: string,
  recordKey: string | undefined,
  issues: FieldIssue[],
  level: "warn" | "error" = "warn",
) {
  if (issues.length === 0) return;
  const head = `[${scope}] ${issues.length} field issue(s)${recordKey ? ` on record=${recordKey}` : ""}`;
  const log = level === "error" ? console.error : console.warn;
  log(head);
  for (const i of issues) {
    log(
      `  • field="${i.field}" expected=${i.expected} received_type=${i.received_type} ` +
      `sample=${i.received_sample} reason=${i.reason}${i.hint ? ` hint="${i.hint}"` : ""}`,
    );
  }
}

/**
 * Validate a batch and split it into { valid, invalid } so the caller can keep going
 * on the valid subset and surface clear diagnostics for the rest.
 */
export function partitionValidRecords<T extends Record<string, unknown>>(
  scope: string,
  records: T[],
  specs: FieldSpec[],
  keyField?: keyof T,
  maxLoggedInvalid = 10,
): { valid: T[]; invalid: Array<{ record: T; issues: FieldIssue[] }> } {
  const valid: T[] = [];
  const invalid: Array<{ record: T; issues: FieldIssue[] }> = [];
  let loggedCount = 0;
  for (const r of records) {
    const issues = validateRecord(r, specs);
    if (issues.length === 0) {
      valid.push(r);
    } else {
      invalid.push({ record: r, issues });
      if (loggedCount < maxLoggedInvalid) {
        const key = keyField ? String(r[keyField] ?? "<no-key>") : undefined;
        logFieldIssues(scope, key, issues, "warn");
        loggedCount++;
      }
    }
  }
  if (invalid.length > maxLoggedInvalid) {
    console.warn(
      `[${scope}] +${invalid.length - maxLoggedInvalid} more invalid record(s) hidden (cap=${maxLoggedInvalid}).`,
    );
  }
  if (invalid.length > 0) {
    console.warn(
      `[${scope}] batch summary: total=${records.length} valid=${valid.length} invalid=${invalid.length}`,
    );
  }
  return { valid, invalid };
}

/** Format a Postgrest / generic error with extra context, including which record(s) triggered it. */
export function formatDbError(
  scope: string,
  err: { message?: string; code?: string; details?: string; hint?: string } | unknown,
  context?: Record<string, unknown>,
): string {
  const e = err as any;
  const parts: string[] = [`[${scope}]`];
  if (e?.code) parts.push(`code=${e.code}`);
  parts.push(`message=${e?.message || String(err)}`);
  if (e?.details) parts.push(`details=${e.details}`);
  if (e?.hint) parts.push(`hint=${e.hint}`);
  if (context && Object.keys(context).length > 0) {
    parts.push(`context=${sampleValue(context, 400)}`);
  }
  return parts.join(" ");
}
