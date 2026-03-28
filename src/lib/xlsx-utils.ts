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
    const { error } = await supabase.from("products").upsert({
      name: r.name,
      slug: r.slug || slugify(r.name),
      gtin: r.gtin || null,
      cnk_code: r.cnk_code || null,
      description: r.description || null,
      short_description: r.short_description || null,
      source: r.source || "medikong",
    }, { onConflict: "slug" });
    if (error) errors.push(`${r.name}: ${error.message}`);
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
      description: r.description || null,
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
