import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCode } from "./parse.ts";
import { resolveDiscountPct, computeVerdict } from "./pricing.ts";

Deno.test("DataMatrix NAN : GTIN, lot, péremption, AI 21 supprimé", () => {
  // NAN OPTIPRO 1 800 g — GTIN 7613287152343 (format GS1 : 01 + GTIN-14)
  const raw = "]d2" + "0107613287152343" + "17270531" + "10NAN24A15\x1d" + "21SERIAL123456789";
  const p = parseCode(raw, "datamatrix");
  assertEquals(p.gtin, "7613287152343");
  assertEquals(p.lot, "NAN24A15");
  assertEquals(p.expiry_date, "2027-05-31");
  assertEquals(p.sanitized_raw.includes("SERIAL"), false);
  assertEquals(p.sanitized_raw.includes("(21)"), false);
});

Deno.test("DataMatrix : série avant lot, jour 00 = fin de mois", () => {
  const p = parseCode("010761328715234321ABC\x1d17261100" + "10L1", "datamatrix");
  assertEquals(p.gtin, "7613287152343");
  assertEquals(p.expiry_date, "2026-11-30");
  assertEquals(p.lot, "L1");
  assertEquals(p.sanitized_raw.includes("ABC"), false);
});

Deno.test("EAN-13 et CNK", () => {
  assertEquals(parseCode("7613287152343", "ean13").gtin, "7613287152343");
  assertEquals(parseCode("4761-839", "manual_cnk").cnk, "4761839");
  assertEquals(parseCode("7613287152344", "ean13").kind, "unknown");
});

Deno.test("Remise marque prioritaire sur catégorie et générale", () => {
  const rules = { version: 2, general_pct: 4, categories: [{ category_id: "c1", pct: 5 }], brands: [{ brand_id: "b1", pct: 12 }] };
  assertEquals(resolveDiscountPct({ rules, brandId: "b1", categoryIds: ["c1"] }), 12);
  assertEquals(resolveDiscountPct({ rules, brandId: "bX", categoryIds: ["c1"] }), 5);
  assertEquals(resolveDiscountPct({ rules, brandId: "bX", categoryIds: ["cX"] }), 4);
  assertEquals(resolveDiscountPct({ rules: null, overrideDefaultPct: 3, wholesalerDefaultPct: 2 }), 3);
  assertEquals(resolveDiscountPct({ rules: {}, wholesalerDefaultPct: 2 }), 2);
});

Deno.test("Verdict", () => {
  assertEquals(computeVerdict(10, 11).verdict, "green");
  assertEquals(computeVerdict(10, 9.5).verdict, "orange");
  assertEquals(computeVerdict(10, 8).verdict, "red");
  assertEquals(computeVerdict(null, 8).verdict, "none");
});
