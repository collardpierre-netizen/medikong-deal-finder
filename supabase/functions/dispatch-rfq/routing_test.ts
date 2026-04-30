import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Row = {
  scenario: string;
  expected: number;
  actual: number;
  ok: boolean;
  details: string | null;
};

async function runSelfTest(): Promise<Row[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rfq_routing_self_test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: "{}",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC failed ${res.status}: ${text}`);
  return JSON.parse(text) as Row[];
}

Deno.test("RFQ routing — all scenarios pass", async () => {
  assert(SUPABASE_URL, "VITE_SUPABASE_URL must be set");
  assert(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY must be set");

  const rows = await runSelfTest();
  assert(rows.length >= 8, `Expected at least 8 scenarios, got ${rows.length}`);

  const failures = rows.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error("Failed scenarios:");
    for (const f of failures) {
      console.error(
        `  ✗ ${f.scenario} — expected=${f.expected} actual=${f.actual} details=${f.details}`,
      );
    }
  } else {
    for (const r of rows) {
      console.log(`  ✓ ${r.scenario}`);
    }
  }
  assertEquals(failures.length, 0, `${failures.length} routing scenario(s) failed`);
});

Deno.test("RFQ routing — BE buyer excludes ES (non-adjacent)", async () => {
  const rows = await runSelfTest();
  const r = rows.find((x) =>
    x.scenario.includes("ES vendor (not adjacent to BE) is excluded")
  );
  assert(r, "Scenario missing");
  assertEquals(r.actual, 0);
  assert(r.ok);
});

Deno.test("RFQ routing — FR buyer includes ES (adjacent)", async () => {
  const rows = await runSelfTest();
  const r = rows.find((x) =>
    x.scenario.includes("ES vendor (adjacent to FR) is included")
  );
  assert(r, "Scenario missing");
  assertEquals(r.actual, 1);
  assert(r.ok);
});

Deno.test("RFQ routing — direct offer takes priority reason=product_offer", async () => {
  const rows = await runSelfTest();
  const r = rows.find((x) => x.scenario.includes("reason=product_offer"));
  assert(r, "Scenario missing");
  assertEquals(r.details, "product_offer");
});

Deno.test("RFQ routing — category interest selects vendor", async () => {
  const rows = await runSelfTest();
  const r = rows.find((x) =>
    x.scenario.includes("category interest is selected")
  );
  assert(r, "Scenario missing");
  assert(r.ok);
});

Deno.test("RFQ routing — inactive vendor always excluded", async () => {
  const rows = await runSelfTest();
  const r = rows.find((x) => x.scenario.includes("Inactive vendor"));
  assert(r, "Scenario missing");
  assertEquals(r.actual, 0);
});

Deno.test("RFQ routing — NULL country vendor always eligible", async () => {
  const rows = await runSelfTest();
  const r = rows.find((x) => x.scenario.includes("NULL country_code"));
  assert(r, "Scenario missing");
  assertEquals(r.actual, 1);
});
