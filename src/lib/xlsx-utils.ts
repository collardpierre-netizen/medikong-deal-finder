import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function exportToXlsx(data: any[], filename: string, sheetName = "Data") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast.success(`${data.length} lignes exportées`);
}

export function downloadProductTemplate() {
  const headers = [
    { gtin: "5412345678901", name: "Exemple Produit Médical", slug: "", cnk_code: "1234567", sku: "", brand_name: "Marque Exemple", category_name: "Catégorie Exemple", description: "Description du produit", short_description: "Description courte", unit_quantity: 1, origin_country: "BE", image_urls: "https://example.com/img1.jpg;https://example.com/img2.jpg", source: "medikong", is_active: true },
  ];
  const ws = XLSX.utils.json_to_sheet(headers);
  // Set column widths
  ws["!cols"] = [
    { wch: 16 }, { wch: 35 }, { wch: 25 }, { wch: 12 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 8 },
    { wch: 8 }, { wch: 50 }, { wch: 12 }, { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produits");
  // Add a "Guide" sheet with instructions
  const guide = [
    ["Champ", "Obligatoire", "Description"],
    ["gtin", "Recommandé", "Code EAN/GTIN du produit (13 chiffres). Sert de clé d'unicité si présent."],
    ["name", "OUI", "Nom du produit"],
    ["slug", "Non", "Slug URL (auto-généré à partir du nom si vide)"],
    ["cnk_code", "Non", "Code CNK (Belgique)"],
    ["sku", "Non", "Référence interne"],
    ["brand_name", "Recommandé", "Nom exact de la marque (doit correspondre à une marque existante)"],
    ["category_name", "Recommandé", "Nom exact de la catégorie (doit correspondre à une catégorie existante)"],
    ["description", "Non", "Description longue du produit"],
    ["short_description", "Non", "Description courte"],
    ["unit_quantity", "Non", "Quantité par unité (défaut: 1)"],
    ["origin_country", "Non", "Code pays d'origine (ex: BE, FR, DE)"],
    ["image_urls", "Non", "URLs des images séparées par des points-virgules (;)"],
    ["source", "Non", "Source du produit (défaut: medikong)"],
    ["is_active", "Non", "true ou false (défaut: true)"],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "Guide");
  XLSX.writeFile(wb, "template-import-produits.xlsx");
  toast.success("Template téléchargé");
}

async function fetchAllRows(table: string, orderBy: string, selectCols = "*") {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await (supabase as any).from(table).select(selectCols).order(orderBy).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}


export async function exportProducts() {
  const data = await fetchAllRows("products", "name").catch(() => null);
  if (!data) { toast.error("Erreur export produits"); return; }
  const rows = (data || []).map(p => ({
    gtin: p.gtin, name: p.name, slug: p.slug,
    cnk_code: p.cnk_code, sku: p.sku,
    description: p.description, short_description: p.short_description,
    source: p.source, is_active: p.is_active,
  }));
  exportToXlsx(rows, "medikong-produits", "Produits");
}

export async function exportBrands() {
  const data = await fetchAllRows("brands", "name").catch(() => null);
  if (!data) { toast.error("Erreur export marques"); return; }
  // Fetch translations
  const { data: trData } = await (supabase as any).from("translations").select("*").eq("entity_type", "brand");
  const getTr = (id: string, field: string, locale: string) => {
    const t = (trData || []).find((t: any) => t.entity_id === id && t.field === field && t.locale === locale);
    return t?.value || "";
  };
  // Fetch manufacturers for name resolution
  const mfrs = await fetchAllRows("manufacturers", "name", "id,name").catch(() => []);
  const mfrMap = new Map((mfrs).map((m: any) => [m.id, m.name]));
  const rows = data.map((b: any) => ({
    name: b.name, slug: b.slug, description: b.description || "",
    country_of_origin: b.country_of_origin || "", website_url: b.website_url || "",
    logo_url: b.logo_url || "", manufacturer_name: b.manufacturer_id ? mfrMap.get(b.manufacturer_id) || "" : "",
    is_featured: b.is_featured, is_active: b.is_active, product_count: b.product_count,
    name_fr: getTr(b.id, "name", "fr"), name_nl: getTr(b.id, "name", "nl"), name_de: getTr(b.id, "name", "de"),
    desc_fr: getTr(b.id, "description", "fr"), desc_nl: getTr(b.id, "description", "nl"), desc_de: getTr(b.id, "description", "de"),
  }));
  exportToXlsx(rows, "medikong-marques", "Marques");
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export interface ImportProgress {
  phase: "reading" | "brands" | "manufacturers" | "products" | "resolving" | "done";
  current: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; name: string; code: string; message: string }[];
  brandsCreated: number;
  manufacturersCreated: number;
}

export async function importProducts(file: File, onProgress?: (p: ImportProgress) => void): Promise<{ created: number; updated: number; skipped: number; errors: { line: number; name: string; code: string; message: string }[]; brandsCreated: number; manufacturersCreated: number; totalRows: number }> {
  const rows = await readXlsx(file);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let brandsCreated = 0;
  let manufacturersCreated = 0;
  const notify = () => onProgress?.({ phase: currentPhase, current: currentIdx, total: rows.length, created, updated, skipped, errors, brandsCreated, manufacturersCreated });
  let currentPhase: ImportProgress["phase"] = "reading";
  let currentIdx = 0;
  notify();

  const errors: { line: number; name: string; code: string; message: string }[] = [];

  // --- Auto-create brands & manufacturers ---
  const brandNames = new Set<string>();
  const mfrNames = new Set<string>();
  for (const row of rows) {
    const r = row as any;
    if (r.brand_name) brandNames.add(String(r.brand_name).trim());
    if (r.manufacturer_name) mfrNames.add(String(r.manufacturer_name).trim());
  }

  currentPhase = "manufacturers"; notify();
  if (mfrNames.size > 0) {
    const { data: existingMfrs } = await supabase.from("manufacturers").select("name").limit(5000);
    const existingSet = new Set((existingMfrs || []).map(m => m.name.toLowerCase()));
    for (const name of mfrNames) {
      if (!existingSet.has(name.toLowerCase())) {
        const { error } = await supabase.from("manufacturers").upsert(
          { name, slug: slugify(name), is_active: true },
          { onConflict: "slug" }
        );
        if (!error) { manufacturersCreated++; existingSet.add(name.toLowerCase()); }
      }
    }
  }

  currentPhase = "brands"; notify();
  if (brandNames.size > 0) {
    const { data: existingBrands } = await supabase.from("brands").select("name").limit(5000);
    const existingSet = new Set((existingBrands || []).map(b => b.name.toLowerCase()));
    const { data: allMfrs } = await supabase.from("manufacturers").select("id,name").limit(5000);
    const mfrByName = new Map((allMfrs || []).map(m => [m.name.toLowerCase(), m.id]));

    for (const name of brandNames) {
      if (!existingSet.has(name.toLowerCase())) {
        const payload: any = { name, slug: slugify(name), is_active: true };
        const mfrId = mfrByName.get(name.toLowerCase()) || null;
        if (mfrId) payload.manufacturer_id = mfrId;
        const { error } = await supabase.from("brands").upsert(payload, { onConflict: "slug" });
        if (!error) { brandsCreated++; existingSet.add(name.toLowerCase()); }
      }
    }
  }

  // Pre-fetch existing slugs to detect duplicates vs new
  const existingSlugs = new Set<string>();
  const allProducts = await fetchAllRows("products", "slug", "slug");
  allProducts.forEach((p: any) => existingSlugs.add(p.slug));

  // --- Import products ---
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as any;
    const lineNum = i + 2; // +2 for header row + 0-index
    if (!r.name) { errors.push({ line: lineNum, name: "—", code: "MISSING_NAME", message: "Nom du produit manquant" }); skipped++; continue; }
    const slug = r.slug || slugify(r.name);
    const isUpdate = existingSlugs.has(slug);
    const rawImageUrls = r.image_urls ?? r.image_url ?? r["Image URL"] ?? r["Image URL "] ?? r["image url"] ?? "";
    const imageUrls = String(rawImageUrls)
      .split(/[;\n,]+/)
      .map((u: string) => u.trim())
      .filter((u: string) => /^https?:\/\//i.test(u));
    const payload: any = {
      name: r.name,
      slug,
      gtin: r.gtin ? String(r.gtin) : null,
      cnk_code: r.cnk_code ? String(r.cnk_code) : null,
      sku: r.sku ? String(r.sku) : null,
      brand_name: r.brand_name || null,
      category_name: r.category_name || null,
      description: r.description || null,
      short_description: r.short_description || null,
      unit_quantity: r.unit_quantity ? Number(r.unit_quantity) : 1,
      origin_country: r.origin_country || null,
      source: r.source || "medikong",
      is_active: r.is_active === false || r.is_active === "false" ? false : true,
    };
    if (imageUrls.length > 0) payload.image_urls = imageUrls;
    const { error } = await supabase.from("products").upsert(payload, { onConflict: "slug" });
    if (error) {
      const code = error.code === "23505" ? "DUPLICATE" : error.code || "DB_ERROR";
      errors.push({ line: lineNum, name: r.name, code, message: error.message });
      skipped++;
    } else {
      if (isUpdate) updated++;
      else { created++; existingSlugs.add(slug); }
    }
  }
  await supabase.rpc("resolve_product_brands");
  await supabase.rpc("resolve_product_categories");
  return { created, updated, skipped, errors, brandsCreated, manufacturersCreated, totalRows: rows.length };
}

export async function importBrands(file: File): Promise<{ created: number; errors: string[] }> {
  const rows = await readXlsx(file);
  let created = 0;
  const errors: string[] = [];
  // Fetch manufacturers for name resolution
  const { data: mfrs } = await supabase.from("manufacturers").select("id,name").limit(2000);
  const mfrByName = new Map((mfrs || []).map(m => [m.name.toLowerCase().trim(), m.id]));
  const translationItems: { entity_type: "brand"; entity_id: string; locale: string; field: string; value: string }[] = [];
  for (const row of rows) {
    const r = row as any;
    if (!r.name) { errors.push("Ligne ignorée: nom manquant"); continue; }
    // Resolve manufacturer
    let manufacturerId: string | null = null;
    if (r.manufacturer_name) {
      manufacturerId = mfrByName.get(String(r.manufacturer_name).toLowerCase().trim()) || null;
    }
    const { data: upserted, error } = await supabase.from("brands").upsert({
      name: r.name,
      slug: r.slug || slugify(r.name),
      description: r.description || null,
      country_of_origin: r.country_of_origin || null,
      website_url: r.website_url || null,
      logo_url: r.logo_url || null,
      manufacturer_id: manufacturerId,
      is_featured: r.is_featured === true || r.is_featured === "true",
      is_active: r.is_active === false || r.is_active === "false" ? false : true,
    }, { onConflict: "slug" }).select("id").single();
    if (error) { errors.push(`${r.name}: ${error.message}`); continue; }
    created++;
    const brandId = upserted?.id;
    if (!brandId) continue;
    for (const locale of ["fr", "nl", "de"] as const) {
      const nameVal = r[`name_${locale}`]?.toString().trim();
      const descVal = r[`desc_${locale}`]?.toString().trim();
      if (nameVal) translationItems.push({ entity_type: "brand", entity_id: brandId, locale, field: "name", value: nameVal });
      if (descVal) translationItems.push({ entity_type: "brand", entity_id: brandId, locale, field: "description", value: descVal });
    }
  }
  // Batch save translations
  if (translationItems.length > 0) {
    for (let i = 0; i < translationItems.length; i += 50) {
      await (supabase as any).from("translations").upsert(translationItems.slice(i, i + 50), { onConflict: "entity_type,entity_id,locale,field" });
    }
  }
  return { created, errors };
}

export async function exportCategories() {
  const data = await fetchAllRows("categories", "display_order").catch(() => null);
  if (!data) { toast.error("Erreur export catégories"); return; }
  // Fetch translations
  const { data: trData } = await (supabase as any).from("translations").select("*").eq("entity_type", "category");
  const trMap = new Map<string, Record<string, string>>();
  (trData || []).forEach((t: any) => {
    const key = `${t.entity_id}_${t.field}_${t.locale}`;
    trMap.set(key, t);
  });
  const getTr = (id: string, field: string, locale: string) => {
    const entry = trMap.get(`${id}_${field}_${locale}`);
    return (entry as any)?.value || "";
  };
  // Build parent name lookup
  const catMap = new Map((data || []).map((c: any) => [c.id, c]));
  const rows = (data || []).map((c: any) => {
    const parent: any = c.parent_id ? catMap.get(c.parent_id) : null;
    return {
      name: c.name, slug: c.slug,
      parent_name: parent ? parent.name : "",
      name_fr: getTr(c.id, "name", "fr"), name_nl: getTr(c.id, "name", "nl"), name_de: getTr(c.id, "name", "de"),
      description: c.description || "",
      desc_fr: getTr(c.id, "description", "fr"), desc_nl: getTr(c.id, "description", "nl"), desc_de: getTr(c.id, "description", "de"),
      display_order: c.display_order, vat_rate: c.vat_rate, hs_code: c.hs_code, icon: c.icon || "", is_active: c.is_active,
    };
  });
  exportToXlsx(rows, "medikong-categories", "Catégories");
}

export async function importCategories(file: File): Promise<{ created: number; errors: string[] }> {
  const rows = await readXlsx(file);
  let created = 0;
  const errors: string[] = [];

  // Sort rows: L1 first, then L2, then L3 (parents before children)
  const levelOrder = (r: any) => {
    const lvl = String(r.level || "").toUpperCase();
    if (lvl === "L1" || !r.parent_name) return 0;
    if (lvl === "L2") return 1;
    return 2;
  };
  const sortedRows = [...rows].sort((a: any, b: any) => levelOrder(a) - levelOrder(b));

  // Pre-fetch all categories to resolve parent_name
  const allCats = await fetchAllRows("categories", "name", "id,name,slug");
  const catByName = new Map(allCats.map((c: any) => [c.name.toLowerCase().trim(), c]));
  const translationItems: { entity_type: "category"; entity_id: string; locale: string; field: string; value: string }[] = [];

  for (const row of sortedRows) {
    const r = row as any;
    if (!r.name) { errors.push("Ligne ignorée: nom manquant"); continue; }
    // Resolve parent
    let parentId: string | null = null;
    if (r.parent_name) {
      const parentCat = catByName.get(String(r.parent_name).toLowerCase().trim());
      if (parentCat) {
        parentId = parentCat.id;
      } else {
        errors.push(`${r.name}: parent "${r.parent_name}" non trouvé`);
      }
    }
    const slug = r.slug || slugify(r.name);
    const isActive = r.is_active !== undefined ? (r.is_active === true || r.is_active === 1 || r.is_active === "1" || r.is_active === "true") : true;
    const { data: upserted, error } = await supabase.from("categories").upsert({
      name: r.name,
      slug,
      parent_id: parentId,
      name_fr: r.name_fr || null,
      description: r.description || null,
      display_order: r.display_order ? Number(r.display_order) : 0,
      vat_rate: r.vat_rate ? Number(r.vat_rate) : null,
      hs_code: r.hs_code || null,
      icon: r.icon || null,
      is_active: isActive,
    }, { onConflict: "slug" }).select("id").single();
    if (error) { errors.push(`${r.name}: ${error.message}`); continue; }
    created++;
    const catId = upserted?.id;
    if (!catId) continue;
    // Update local lookup for subsequent parent resolution
    catByName.set(r.name.toLowerCase().trim(), { id: catId, name: r.name, slug });
    // Collect translations for all 3 locales
    for (const locale of ["fr", "nl", "de"] as const) {
      const nameVal = r[`name_${locale}`]?.toString().trim();
      const descVal = r[`desc_${locale}`]?.toString().trim();
      if (nameVal) translationItems.push({ entity_type: "category", entity_id: catId, locale, field: "name", value: nameVal });
      if (descVal) translationItems.push({ entity_type: "category", entity_id: catId, locale, field: "description", value: descVal });
    }
  }
  // Batch save translations
  if (translationItems.length > 0) {
    for (let i = 0; i < translationItems.length; i += 50) {
      const batch = translationItems.slice(i, i + 50);
      await (supabase as any).from("translations").upsert(batch, { onConflict: "entity_type,entity_id,locale,field" });
    }
  }
  return { created, errors };
}

function readXlsx(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Manufacturers ────────────────────────────────────
export function downloadManufacturerTemplate() {
  const example = [
    { name: "Exemple Fabricant", slug: "", legal_name: "Exemple SA", country_of_origin: "BE", year_founded: 2000, logo_url: "https://example.com/logo.png", website_url: "https://example.com", description: "Description du fabricant", certifications: "ISO 13485, CE", specialties: "Wound care, Incontinence", is_active: true },
  ];
  const ws = XLSX.utils.json_to_sheet(example);
  ws["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 35 }, { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fabricants");
  const guide = [
    ["Champ", "Obligatoire", "Description"],
    ["name", "OUI", "Nom du fabricant"],
    ["slug", "Non", "Slug URL (auto-généré si vide)"],
    ["legal_name", "Non", "Raison sociale"],
    ["country_of_origin", "Non", "Code pays (BE, FR, DE, etc.)"],
    ["year_founded", "Non", "Année de fondation"],
    ["logo_url", "Non", "URL du logo"],
    ["website_url", "Non", "URL du site web"],
    ["description", "Non", "Description du fabricant"],
    ["certifications", "Non", "Certifications séparées par des virgules"],
    ["specialties", "Non", "Spécialités séparées par des virgules"],
    ["is_active", "Non", "true ou false (défaut: true)"],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "Guide");
  XLSX.writeFile(wb, "template-import-fabricants.xlsx");
  toast.success("Template téléchargé");
}

export async function exportManufacturers() {
  const data = await fetchAllRows("manufacturers", "name").catch(() => null);
  if (!data) { toast.error("Erreur export fabricants"); return; }
  const rows = (data || []).map((m: any) => ({
    name: m.name, slug: m.slug, legal_name: m.legal_name || "",
    country_of_origin: m.country_of_origin || "", year_founded: m.year_founded || "",
    logo_url: m.logo_url || "", website_url: m.website_url || "",
    description: m.description || "",
    certifications: (m.certifications || []).join(", "),
    specialties: (m.specialties || []).join(", "),
    brand_count: m.brand_count || 0, product_count: m.product_count || 0,
    is_active: m.is_active,
  }));
  exportToXlsx(rows, "medikong-fabricants", "Fabricants");
}

export async function importManufacturers(file: File): Promise<{ created: number; errors: string[] }> {
  const rows = await readXlsx(file);
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const r = row as any;
    if (!r.name) { errors.push("Ligne ignorée: nom manquant"); continue; }
    const { error } = await supabase.from("manufacturers").upsert({
      name: r.name,
      slug: r.slug || slugify(r.name),
      legal_name: r.legal_name || null,
      country_of_origin: r.country_of_origin || null,
      year_founded: r.year_founded ? Number(r.year_founded) : null,
      logo_url: r.logo_url || null,
      website_url: r.website_url || null,
      description: r.description || null,
      certifications: r.certifications ? String(r.certifications).split(",").map(s => s.trim()).filter(Boolean) : [],
      specialties: r.specialties ? String(r.specialties).split(",").map(s => s.trim()).filter(Boolean) : [],
      is_active: r.is_active === false || r.is_active === "false" ? false : true,
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
    else created++;
  }
  return { created, errors };
}
