import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── EXPORT ───

export function exportToXlsx(data: any[], filename: string, sheetName = "Data") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast.success(`${data.length} lignes exportées`);
}

export async function exportProducts() {
  const { data, error } = await supabase.from("products").select("*").order("product_name");
  if (error) { toast.error("Erreur export produits"); return; }
  const rows = (data || []).map(p => ({
    gtin: p.gtin, product_name: p.product_name, brand: p.brand,
    mpn: p.mpn, cnk: p.cnk, category_l1: p.category_l1, category_l2: p.category_l2,
    category_l3: p.category_l3, weight_g: p.weight_g, rrp_eur: p.rrp_eur,
    description_short: p.description_short, status: p.status,
  }));
  exportToXlsx(rows, "medikong-produits", "Produits");
}

export async function exportBrands() {
  const { data, error } = await supabase.from("brands").select("*, manufacturers(name)").order("name");
  if (error) { toast.error("Erreur export marques"); return; }
  const rows = (data || []).map(b => ({
    name: b.name, slug: b.slug, country: b.country, website: b.website,
    tier: b.tier, manufacturer: (b.manufacturers as any)?.name || "",
    certifications: (b.certifications || []).join(", "),
    products_count: b.products_count, description_fr: b.description_fr,
  }));
  exportToXlsx(rows, "medikong-marques", "Marques");
}

export async function exportManufacturers() {
  const { data, error } = await supabase.from("manufacturers").select("*").order("name");
  if (error) { toast.error("Erreur export fabricants"); return; }
  const rows = (data || []).map(m => ({
    name: m.name, slug: m.slug, country: m.country, city: m.city,
    website: m.website, employees: m.employees, revenue: m.revenue,
    brands: (m.brands || []).join(", "),
    certifications: (m.certifications || []).join(", "),
    description_fr: m.description_fr, status: m.status,
  }));
  exportToXlsx(rows, "medikong-fabricants", "Fabricants");
}

// ─── IMPORT ───

function readXlsx(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
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
    if (!r.gtin || !r.product_name || !r.brand) {
      errors.push(`Ligne ignorée: GTIN, product_name ou brand manquant`);
      continue;
    }
    const { error } = await supabase.from("products").upsert({
      gtin: String(r.gtin),
      product_name: r.product_name,
      brand: r.brand,
      mpn: r.mpn || r.cnk || null,
      cnk: r.cnk || null,
      category_l1: r.category_l1 || "Non classé",
      category_l2: r.category_l2 || "Non classé",
      category_l3: r.category_l3 || "Non classé",
      weight_g: Number(r.weight_g) || 0,
      rrp_eur: r.rrp_eur ? Number(r.rrp_eur) : null,
      description_short: r.description_short || null,
      status: (r.status as any) || "active",
    }, { onConflict: "gtin" });
    if (error) errors.push(`GTIN ${r.gtin}: ${error.message}`);
    else created++;
  }
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
      country: r.country || null,
      website: r.website || null,
      tier: r.tier || "Bronze",
      certifications: r.certifications ? String(r.certifications).split(",").map(s => s.trim()) : [],
      description_fr: r.description_fr || null,
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
    else created++;
  }
  return { created, errors };
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
      country: r.country || null,
      city: r.city || null,
      website: r.website || null,
      employees: r.employees || null,
      revenue: r.revenue || null,
      brands: r.brands ? String(r.brands).split(",").map(s => s.trim()) : [],
      certifications: r.certifications ? String(r.certifications).split(",").map(s => s.trim()) : [],
      description_fr: r.description_fr || null,
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
    else created++;
  }
  return { created, errors };
}
