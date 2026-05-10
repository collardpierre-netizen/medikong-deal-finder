// Calculateur d'économies — pipeline de traitement
// Reçoit un bon de commande (PDF/JPG/PNG/CSV), extrait les lignes via OCR LLM,
// matche avec le catalogue MediKong, calcule les économies, alimente l'observatoire.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const VISION_MODEL = "google/gemini-2.5-pro";

type Supplier = "febelco" | "cerp" | "pharma_belgium" | "other";
type FileKind = "pdf" | "image" | "csv";

interface ExtractedLine {
  line_number: number;
  cnk: string | null;
  ean: string | null;
  proprietary_code: string | null;
  raw_label: string;
  normalized_name_guess: string | null;
  brand_guess: string | null;
  quantity: number;
  unit_price_excl_vat: number;
  confidence: number;
}

const OCR_PROMPT = `Tu reçois un bon de commande de grossiste pharmaceutique belge (Febelco, CERP, Pharma Belgium ou autre). Beaucoup utilisent des codes propriétaires (pas le CNK belge à 7 chiffres ni l'EAN à 13 chiffres) et des libellés tronqués.

Pour chaque ligne de produit, extrais en JSON strict :
{
  "supplier": "febelco" | "cerp" | "pharma_belgium" | "other",
  "lines": [
    {
      "line_number": 1,
      "cnk": "0123456" | null,
      "ean": "5400123456789" | null,
      "proprietary_code": "F12345" | null,
      "raw_label": "DAFAL 1G CPR EFF 16",
      "normalized_name_guess": "Dafalgan 1g comprimés effervescents 16",
      "brand_guess": "Dafalgan" | null,
      "quantity": 5,
      "unit_price_excl_vat": 4.85,
      "confidence": 0.7
    }
  ]
}

Règles strictes :
- CNK belge = 7 chiffres exacts. EAN = 13 chiffres exacts. Sinon null.
- Code ni CNK ni EAN -> proprietary_code.
- Hésitation sur un champ -> null. Pas d'invention.
- Devine normalized_name_guess si libellé tronqué et baisse confidence (0.5-0.8).
- Saute les lignes non-produits (frais de port, remise, mention légale).
- Réponse JSON strict uniquement, pas de markdown, pas de commentaire.`;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function detectFileKind(mime: string): FileKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg" || mime === "image/png") return "image";
  if (mime === "text/csv" || mime === "application/vnd.ms-excel") return "csv";
  return null;
}

function normalizeCity(city: string | null): string | null {
  if (!city) return null;
  return city.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function startOfIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function pharmacyBucket(total: number | null): "small" | "medium" | "large" {
  if (!total || total < 1000) return "small";
  if (total < 5000) return "medium";
  return "large";
}

async function fileToBase64(file: File | Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.byteLength; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

// CSV parser minimal
function parseCsv(text: string, supplier: Supplier): { supplier: Supplier; lines: ExtractedLine[] } {
  const rows = text.split(/\r?\n/).filter((r) => r.trim().length > 0);
  if (rows.length === 0) return { supplier, lines: [] };
  const sep = rows[0].includes(";") ? ";" : ",";
  const header = rows[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iCnk = idx(["cnk"]);
  const iEan = idx(["ean", "gtin"]);
  const iCode = idx(["code", "ref", "produit"]);
  const iName = idx(["libelle", "libellé", "nom", "designation", "désignation", "name"]);
  const iQty = idx(["quantite", "quantité", "qty", "qte"]);
  const iPrice = idx(["prix", "price", "pu", "unitaire"]);

  const lines: ExtractedLine[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 2) continue;
    const cnk = iCnk >= 0 ? (cells[iCnk] || "").replace(/\D/g, "") : "";
    const ean = iEan >= 0 ? (cells[iEan] || "").replace(/\D/g, "") : "";
    const codeRaw = iCode >= 0 ? (cells[iCode] || "").trim() : "";
    const name = iName >= 0 ? cells[iName] : "";
    const qtyStr = iQty >= 0 ? cells[iQty] : "1";
    const priceStr = iPrice >= 0 ? cells[iPrice] : "0";
    const qty = parseInt(qtyStr.replace(/[^\d]/g, ""), 10) || 1;
    const price = parseFloat(priceStr.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
    if (!name && !cnk && !ean && !codeRaw) continue;
    lines.push({
      line_number: r,
      cnk: cnk.length === 7 ? cnk : null,
      ean: ean.length === 13 ? ean : null,
      proprietary_code: codeRaw && codeRaw.length > 0 && (cnk.length !== 7 && ean.length !== 13) ? codeRaw : null,
      raw_label: name || codeRaw,
      normalized_name_guess: name || null,
      brand_guess: null,
      quantity: qty,
      unit_price_excl_vat: price,
      confidence: 1.0,
    });
  }
  return { supplier, lines };
}

async function callVisionLLM(file: File): Promise<{ supplier: Supplier; lines: ExtractedLine[] }> {
  const base64 = await fileToBase64(file);
  const mime = file.type;
  console.log("[vision] file", { mime, sizeKB: Math.round(file.size / 1024), b64Len: base64.length });

  // Lovable AI Gateway (OpenAI-compatible) accepts PDFs/images via image_url data URL for Gemini
  // and also via the file content type. We use Bearer auth which is the documented format.
  const dataUrl = `data:${mime};base64,${base64}`;
  const t0 = Date.now();
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  console.log("[vision] ai-gateway response", { status: res.status, ms: Date.now() - t0 });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`vision LLM ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  console.log("[vision] content length", text.length);
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match?.[0] ?? "{}");
    console.log("[vision] parsed lines", parsed?.lines?.length ?? 0);
    return parsed;
  } catch (e) {
    console.error("[vision] JSON parse fail", e, text.slice(0, 200));
    return { supplier: "other", lines: [] };
  }
}

interface MatchResult {
  product_id: string | null;
  confidence: number;
  method: "cnk" | "ean" | "proprietary_code" | "name_fuzzy" | "no_match";
}

async function matchLine(
  supabase: ReturnType<typeof getAdminClient>,
  line: ExtractedLine,
  supplier: Supplier,
): Promise<MatchResult> {
  // 1. CNK
  if (line.cnk) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("cnk_code", line.cnk)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (data) return { product_id: data.id, confidence: 1.0, method: "cnk" };
  }
  // 2. EAN
  if (line.ean) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("gtin", line.ean)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (data) return { product_id: data.id, confidence: 0.95, method: "ean" };
  }
  // 3. Code propriétaire appris
  if (line.proprietary_code) {
    const { data } = await supabase
      .from("supplier_proprietary_codes")
      .select("matched_product_id, confidence")
      .eq("source_supplier", supplier)
      .eq("proprietary_code", line.proprietary_code)
      .not("matched_product_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (data?.matched_product_id) {
      await supabase.rpc("increment_proprietary_code_observation", {
        _supplier: supplier,
        _code: line.proprietary_code,
      });
      return {
        product_id: data.matched_product_id,
        confidence: Number(data.confidence) || 0.8,
        method: "proprietary_code",
      };
    }
  }
  // 4. Similarity nom
  if (line.normalized_name_guess) {
    const { data } = await supabase.rpc("match_product_by_name", {
      query_name: line.normalized_name_guess,
      query_brand: line.brand_guess,
      threshold: 0.55,
    });
    if (data && data.length > 0 && Number(data[0].similarity) >= 0.7) {
      const best = data[0];
      // Apprentissage : si on avait un code propriétaire, on l'enregistre
      if (line.proprietary_code) {
        await supabase.from("supplier_proprietary_codes").upsert(
          {
            source_supplier: supplier,
            proprietary_code: line.proprietary_code,
            proprietary_label: line.raw_label,
            matched_product_id: best.id,
            confidence: Number(best.similarity),
            match_method: "llm",
            observation_count: 1,
            last_observed_at: new Date().toISOString(),
          },
          { onConflict: "source_supplier,proprietary_code", ignoreDuplicates: false },
        );
      }
      return {
        product_id: best.id,
        confidence: Number(best.similarity),
        method: "name_fuzzy",
      };
    }
  }
  return { product_id: null, confidence: 0, method: "no_match" };
}

async function getMedikongMinPrice(
  supabase: ReturnType<typeof getAdminClient>,
  productId: string,
): Promise<{ price: number | null; supplierCount: number }> {
  // Lecture via la vue effective_offer_prices_v (si existe), sinon via offers directement
  const { data, error } = await supabase
    .from("effective_offer_prices_v")
    .select("effective_price_cents, vendor_id")
    .eq("product_id", productId);
  if (!error && data && data.length > 0) {
    const prices = data.map((r) => Number(r.effective_price_cents)).filter((n) => n > 0);
    if (prices.length === 0) return { price: null, supplierCount: 0 };
    const minCents = Math.min(...prices);
    const distinctVendors = new Set(data.map((r) => r.vendor_id)).size;
    return { price: minCents / 100, supplierCount: distinctVendors };
  }
  // Fallback offers direct
  const { data: offers } = await supabase
    .from("offers")
    .select("price_ht_cents, vendor_id")
    .eq("product_id", productId)
    .eq("is_active", true);
  if (!offers || offers.length === 0) return { price: null, supplierCount: 0 };
  const prices = offers.map((o) => Number(o.price_ht_cents)).filter((n) => n > 0);
  if (prices.length === 0) return { price: null, supplierCount: 0 };
  return { price: Math.min(...prices) / 100, supplierCount: new Set(offers.map((o) => o.vendor_id)).size };
}

async function processSimulation(simulationId: string, file: File, fileKind: FileKind, supplier: Supplier) {
  const supabase = getAdminClient();
  console.log("[pipeline] start", { simulationId, fileKind, supplier, mime: file.type, size: file.size });
  try {
    // Extraction
    let extracted: { supplier: Supplier; lines: ExtractedLine[] };
    if (fileKind === "csv") {
      const text = await file.text();
      extracted = parseCsv(text, supplier);
    } else {
      extracted = await callVisionLLM(file);
    }
    console.log("[pipeline] extracted", { lines: extracted.lines?.length ?? 0 });

    if (!extracted.lines || extracted.lines.length === 0) {
      await supabase
        .from("savings_simulations")
        .update({ status: "no_match", error_message: "Aucune ligne détectée" })
        .eq("id", simulationId);
      return;
    }

    // Récupère métadonnées simulation pour observation marché
    const { data: sim } = await supabase
      .from("savings_simulations")
      .select("region, source_total_excl_vat, created_at")
      .eq("id", simulationId)
      .single();

    let totalSource = 0;
    let totalMedikong = 0;
    let matchedCount = 0;
    const linesToInsert: any[] = [];
    const observationsToInsert: any[] = [];
    const weekObserved = startOfIsoWeek(new Date(sim?.created_at ?? new Date().toISOString()));

    for (const line of extracted.lines) {
      const lineTotal = (line.unit_price_excl_vat || 0) * (line.quantity || 1);
      totalSource += lineTotal;

      const match = await matchLine(supabase, line, supplier);
      let mkPrice: number | null = null;
      let supplierCount = 0;
      let lineSavings: number | null = null;
      let lineSavingsPct: number | null = null;

      if (match.product_id) {
        matchedCount++;
        const priceInfo = await getMedikongMinPrice(supabase, match.product_id);
        mkPrice = priceInfo.price;
        supplierCount = priceInfo.supplierCount;
        if (mkPrice !== null && line.unit_price_excl_vat > 0) {
          lineSavings = (line.unit_price_excl_vat - mkPrice) * (line.quantity || 1);
          lineSavingsPct = ((line.unit_price_excl_vat - mkPrice) / line.unit_price_excl_vat) * 100;
          totalMedikong += mkPrice * (line.quantity || 1);
        } else {
          totalMedikong += lineTotal; // fallback: pas de meilleure offre
        }
        // Observation marché
        observationsToInsert.push({
          source_supplier: supplier,
          product_id: match.product_id,
          observed_unit_price_excl_vat: line.unit_price_excl_vat,
          observed_quantity: line.quantity,
          week_observed: weekObserved,
          region: sim?.region ?? null,
          pharmacy_size_bucket: pharmacyBucket(totalSource),
        });
      } else {
        totalMedikong += lineTotal;
      }

      linesToInsert.push({
        simulation_id: simulationId,
        line_number: line.line_number,
        raw_text: line.raw_label?.slice(0, 500),
        detected_cnk: line.cnk,
        detected_ean: line.ean,
        detected_proprietary_code: line.proprietary_code,
        detected_name: line.normalized_name_guess?.slice(0, 300) ?? line.raw_label?.slice(0, 300),
        detected_brand: line.brand_guess?.slice(0, 100),
        detected_quantity: line.quantity,
        detected_unit_price_excl_vat: line.unit_price_excl_vat,
        matched_product_id: match.product_id,
        match_confidence: match.confidence,
        match_method: match.method,
        medikong_min_price_excl_vat: mkPrice,
        medikong_supplier_count: supplierCount,
        line_savings: lineSavings,
        line_savings_pct: lineSavingsPct,
      });
    }

    // Insertions par lots
    if (linesToInsert.length > 0) {
      await supabase.from("savings_simulation_lines").insert(linesToInsert);
    }
    if (observationsToInsert.length > 0) {
      await supabase.from("market_price_observations").insert(observationsToInsert);
    }

    const totalLines = extracted.lines.length;
    const matchRate = totalLines > 0 ? matchedCount / totalLines : 0;
    const savingsAmount = totalSource - totalMedikong;
    const savingsPct = totalSource > 0 ? (savingsAmount / totalSource) * 100 : 0;
    const finalStatus = matchedCount === 0 ? "no_match" : "done";

    await supabase
      .from("savings_simulations")
      .update({
        status: finalStatus,
        total_lines: totalLines,
        matched_lines: matchedCount,
        match_rate: Number(matchRate.toFixed(3)),
        source_total_excl_vat: Number(totalSource.toFixed(2)),
        medikong_total_excl_vat: Number(totalMedikong.toFixed(2)),
        savings_amount: Number(savingsAmount.toFixed(2)),
        savings_pct: Number(savingsPct.toFixed(2)),
      })
      .eq("id", simulationId);
  } catch (err) {
    console.error("[process-savings-upload] error", err);
    await supabase
      .from("savings_simulations")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      })
      .eq("id", simulationId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // GET /process-savings-upload?id=... -> polling status
  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "missing id" }, { status: 400, headers: corsHeaders });
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from("savings_simulations")
        .select(
          "id,status,total_lines,matched_lines,match_rate,source_total_excl_vat,medikong_total_excl_vat,savings_amount,savings_pct,error_message,report_path,email_sent_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return Response.json({ error: "not found" }, { status: 404, headers: corsHeaders });
      return Response.json(data, { headers: corsHeaders });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500, headers: corsHeaders });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const email = (form.get("email") as string | null)?.trim();
    const pharmacyName = (form.get("pharmacy_name") as string | null)?.trim();
    const city = (form.get("city") as string | null)?.trim();
    const vatNumber = (form.get("vat_number") as string | null)?.trim();
    const supplier = (form.get("source_supplier") as Supplier | null) ?? "other";
    const consent = form.get("consent_given") === "true";

    if (!file) return Response.json({ error: "missing file" }, { status: 400, headers: corsHeaders });
    if (!consent)
      return Response.json({ error: "consent_required" }, { status: 400, headers: corsHeaders });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json({ error: "invalid_email" }, { status: 400, headers: corsHeaders });
    if (file.size > 10 * 1024 * 1024)
      return Response.json({ error: "file_too_large" }, { status: 400, headers: corsHeaders });

    const fileKind = detectFileKind(file.type);
    if (!fileKind)
      return Response.json({ error: "unsupported_file_type", type: file.type }, { status: 400, headers: corsHeaders });
    if (!["febelco", "cerp", "pharma_belgium", "other"].includes(supplier))
      return Response.json({ error: "invalid_supplier" }, { status: 400, headers: corsHeaders });

    const supabase = getAdminClient();

    // Région BE depuis ville
    let region: string | null = null;
    const cityNorm = normalizeCity(city ?? null);
    if (cityNorm) {
      const { data: prov } = await supabase
        .from("be_city_to_province")
        .select("province")
        .eq("city_normalized", cityNorm)
        .maybeSingle();
      region = prov?.province ?? null;
    }

    // Insert simulation row
    const { data: sim, error: insErr } = await supabase
      .from("savings_simulations")
      .insert({
        email,
        pharmacy_name: pharmacyName,
        city,
        region,
        vat_number: vatNumber,
        source_supplier: supplier,
        source_file_type: fileKind,
        status: "processing",
        ip_address: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      })
      .select("id")
      .single();
    if (insErr || !sim) {
      console.error("insert simulation error", insErr);
      return Response.json({ error: "db_error" }, { status: 500, headers: corsHeaders });
    }

    // Upload fichier dans Storage (clé: <id>/source.<ext>)
    const ext = fileKind === "pdf" ? "pdf" : fileKind === "csv" ? "csv" : file.type === "image/png" ? "png" : "jpg";
    const storageKey = `${sim.id}/source.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("savings-uploads")
      .upload(storageKey, file, { contentType: file.type, upsert: true });
    if (upErr) {
      console.error("storage upload error", upErr);
      // On ne bloque pas le pipeline pour autant
    } else {
      await supabase
        .from("savings_simulations")
        .update({ source_file_path: storageKey })
        .eq("id", sim.id);
    }

    // Pipeline en arrière-plan
    (globalThis as any).EdgeRuntime?.waitUntil(
      processSimulation(sim.id, file, fileKind, supplier),
    );
    // Fallback : si EdgeRuntime n'est pas dispo, on lance quand même
    if (!(globalThis as any).EdgeRuntime) {
      processSimulation(sim.id, file, fileKind, supplier).catch((e) =>
        console.error("background pipeline error", e),
      );
    }

    return Response.json({ id: sim.id, status: "processing" }, { status: 202, headers: corsHeaders });
  } catch (err) {
    console.error("[process-savings-upload] fatal", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders },
    );
  }
});
