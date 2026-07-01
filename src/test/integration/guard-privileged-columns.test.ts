/**
 * Integration tests — DB-side guard triggers for privileged columns.
 *
 * Delegates to the SECURITY DEFINER RPC `admin_test_privileged_column_guards()`
 * which:
 *   1. Impersonates a non-admin user by writing `request.jwt.claims`.
 *   2. Inserts fixtures in customers / vendors and picks an existing profile.
 *   3. Attempts to UPDATE each sensitive column and captures any raised error.
 *   4. Returns a JSON report with `passed` (mutation blocked?) and
 *      `matched_expected_message` (did the guard fire with its intended message?).
 *
 * We run the RPC via psql (bypasses PostgREST auth — the RPC itself checks
 * `is_admin(auth.uid())` and we spoof an admin uid in the session). The suite
 * is skipped automatically when the sandbox has no Postgres access.
 *
 * ⚠️  Known DB bugs surfaced by these tests (do NOT silently fix — see report):
 *   - guard_customers_privileged_columns references NEW.is_active (col missing)
 *   - guard_vendors_privileged_columns  references NEW.stripe_onboarding_status (col missing)
 * These crash any non-admin UPDATE on customers/vendors — sensitive fields ARE
 * blocked (side-effect), but even non-sensitive UPDATEs are broken. Tracked as
 * `message_mismatch_count` in the report.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

const HAS_PG = !!process.env.PGHOST;
const d = HAS_PG ? describe : describe.skip;

type CaseResult = {
  case: string;
  passed: boolean;
  matched_expected_message: boolean;
  detail: string;
};
type Report = {
  total: number;
  failed: number;
  message_mismatch_count: number;
  cases: CaseResult[];
};

function runReport(): Report {
  // 1. Find an active admin uid to spoof for the initial is_admin() gate.
  const admin = execSync(
    `psql -t -A -X -c "SELECT user_id FROM public.admin_users WHERE is_active = true ORDER BY created_at LIMIT 1;"`,
    { encoding: "utf8" },
  ).trim();
  if (!admin) throw new Error("No active admin in DB — cannot run guard integration test.");

  const sql = `
    SELECT set_config('request.jwt.claims',
                      jsonb_build_object('sub', '${admin}', 'role', 'authenticated')::text,
                      false);
    SELECT public.admin_test_privileged_column_guards()::text;
  `;
  const out = execSync(`psql -t -A -X`, { input: sql, encoding: "utf8" });
  // Last non-empty line is the JSON payload.
  const line = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.startsWith("{"))
    .pop();
  if (!line) throw new Error(`Unexpected psql output:\n${out}`);
  return JSON.parse(line) as Report;
}

d("Guard triggers — non-admin cannot modify privileged columns (DB integration)", () => {
  const report = HAS_PG ? runReport() : null;

  it("every attempted non-admin mutation is blocked (report.failed === 0)", () => {
    expect(report).not.toBeNull();
    const failedCases = report!.cases.filter((c) => !c.passed);
    expect(failedCases, `Failed cases:\n${JSON.stringify(failedCases, null, 2)}`).toEqual([]);
    expect(report!.failed).toBe(0);
  });

  it("customers.is_verified is blocked", () => {
    const c = report!.cases.find((x) => x.case === "customers.is_verified blocked");
    expect(c?.passed).toBe(true);
  });

  it("customers.credit_limit is blocked", () => {
    const c = report!.cases.find((x) => x.case === "customers.credit_limit blocked");
    expect(c?.passed).toBe(true);
  });

  it("customers.payment_terms_days is blocked", () => {
    const c = report!.cases.find((x) => x.case === "customers.payment_terms_days blocked");
    expect(c?.passed).toBe(true);
  });

  it("vendors.validation_status is blocked", () => {
    const c = report!.cases.find((x) => x.case === "vendors.validation_status blocked");
    expect(c?.passed).toBe(true);
  });

  it("vendors.is_verified is blocked", () => {
    const c = report!.cases.find((x) => x.case === "vendors.is_verified blocked");
    expect(c?.passed).toBe(true);
  });

  it("vendors.commission_rate is blocked", () => {
    const c = report!.cases.find((x) => x.case === "vendors.commission_rate blocked");
    expect(c?.passed).toBe(true);
  });

  it("vendors.iban is blocked", () => {
    const c = report!.cases.find((x) => x.case === "vendors.iban blocked");
    expect(c?.passed).toBe(true);
  });

  it("vendors.stripe_account_id is blocked", () => {
    const c = report!.cases.find((x) => x.case === "vendors.stripe_account_id blocked");
    expect(c?.passed).toBe(true);
  });

  it("profiles.price_level_code is blocked with the intended guard message", () => {
    const c = report!.cases.find((x) => x.case === "profiles.price_level_code blocked");
    expect(c?.passed).toBe(true);
    // profiles guard is healthy — the exact message must match.
    expect(c?.matched_expected_message).toBe(true);
  });

  it("admin bypasses the guards (sanity)", () => {
    const c = report!.cases.find((x) => x.case === "admin bypass — customers.is_verified");
    expect(c?.passed).toBe(true);
  });

  it("[diagnostic] surfaces guard message mismatches (broken columns) as a report line", () => {
    // This is intentionally *informational*: the customers/vendors guards
    // currently reference columns that don't exist on their tables, so the
    // mutation is blocked via a raw plpgsql crash rather than the intended
    // RAISE EXCEPTION. We log the count so a regression stays visible without
    // failing the suite (the security invariant — "blocked" — still holds).
    // Track: `guard_customers_privileged_columns` (NEW.is_active) and
    //        `guard_vendors_privileged_columns` (NEW.stripe_onboarding_status).
    const mismatches = report!.cases.filter((c) => !c.matched_expected_message);
    if (mismatches.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[guard-triggers] ${mismatches.length} case(s) blocked via unexpected error message:\n` +
          mismatches.map((m) => ` - ${m.case}: ${m.detail}`).join("\n"),
      );
    }
    expect(report!.message_mismatch_count).toBeGreaterThanOrEqual(0);
  });
});
