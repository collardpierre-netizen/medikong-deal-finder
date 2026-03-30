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


export async function exportProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) { toast.error("Erreur export produits"); return; }
  const rows = (data || []).map(p => ({
    gtin: p.gtin, name: p.name, slug: p.slug,
    cnk_code: p.cnk_code, sku: p.sku,
    description: p.description, short_description: p.short_description,
    source: p.source, is_active: p.is_active,
  }));
  exportToXlsx(rows, "medikong-produits", "Produits");
}

export async function exportBrands() {
  const { data, error } = await supabase.from("brands").select("*").order("name");
  if (error) { toast.error("Erreur export marques"); return; }
  const rows = (data || []).map(b => ({
    name: b.name, slug: b.slug, description: b.description,
    product_count: b.product_count, is_featured: b.is_featured,
  }));
  exportToXlsx(rows, "medikong-marques", "Marques");
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function importProducts(file: File): Promise<{ created: number; errors: string[] }> {
  const rows = await readXlsx(file);
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const r = row as any;
    if (!r.name) { errors.push("Ligne ignorée: nom manquant"); continue; }
    const imageUrls = r.image_urls ? String(r.image_urls).split(";").map((u: string) => u.trim()).filter(Boolean) : [];
    const { error } = await supabase.from("products").upsert({
      name: r.name,
      slug: r.slug || slugify(r.name),
      gtin: r.gtin ? String(r.gtin) : null,
      cnk_code: r.cnk_code ? String(r.cnk_code) : null,
      sku: r.sku ? String(r.sku) : null,
      brand_name: r.brand_name || null,
      category_name: r.category_name || null,
      description: r.description || null,
      short_description: r.short_description || null,
      unit_quantity: r.unit_quantity ? Number(r.unit_quantity) : 1,
      origin_country: r.origin_country || null,
      image_urls: imageUrls.length > 0 ? imageUrls : [],
      source: r.source || "medikong",
      is_active: r.is_active === false || r.is_active === "false" ? false : true,
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
    else created++;
  }
  // Resolve brand_id and category_id
  await supabase.rpc("resolve_product_brands");
  await supabase.rpc("resolve_product_categories");
  return { created, errors };
}

export async function importBrands(file: File): Promise<{ created: number; errors: string[] }> {
  const rows = await readXlsx(file);
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const r = row as any;
    if (!r.name) { errors.push("Ligne ignorée: nom manquant"); continue; }
    const { error } = await supabase.from("brands").upsert({
      name: r.name,
      slug: r.slug || slugify(r.name),
      description: r.description || null,
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
    else created++;
  }
  return { created, errors };
}

export async function exportCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("display_order");
  if (error) { toast.error("Erreur export catégories"); return; }
  const rows = (data || []).map(c => ({
    name: c.name, slug: c.slug, description: c.description,
    parent_id: c.parent_id || "", display_order: c.display_order,
    vat_rate: c.vat_rate, hs_code: c.hs_code, is_active: c.is_active,
  }));
  exportToXlsx(rows, "medikong-categories", "Catégories");
}

export async function importCategories(file: File): Promise<{ created: number; errors: string[] }> {
  const rows = await readXlsx(file);
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const r = row as any;
    if (!r.name) { errors.push("Ligne ignorée: nom manquant"); continue; }
    const { error } = await supabase.from("categories").upsert({
      name: r.name,
      slug: r.slug || slugify(r.name),
      description: r.description || null,
      display_order: r.display_order ? Number(r.display_order) : 0,
      vat_rate: r.vat_rate ? Number(r.vat_rate) : null,
      hs_code: r.hs_code || null,
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
    else created++;
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
