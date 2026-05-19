import * as XLSX from "xlsx";
import type { DiscountRow } from "@/hooks/useDiscountSearch";

interface ExportContext {
  reference: "pvp" | "market";
  minDiscountPct: number;
  country: string;
}

function rowsToObjects(rows: DiscountRow[]) {
  return rows.map((r) => ({
    Produit: r.product_name,
    CNK: r.cnk || "",
    Marque: r.brand_name || "",
    Fabricant: r.manufacturer_name || "",
    Vendeur: r.vendor_name || "",
    Pays: r.country_code,
    "Prix MediKong HTVA (€)": (r.best_price_htva_cents / 100).toFixed(2),
    "Prix référence (€)": (r.reference_price_cents / 100).toFixed(2),
    "Type référence": r.reference_kind,
    "Économie %": r.discount_pct,
    MOQ: r.moq,
    "Stock dispo": r.stock_quantity,
    "MOV vendeur (€)": (r.mov_eur_cents / 100).toFixed(2),
    "Délai (j)": r.delivery_days ?? "",
    "Panier MOQ HTVA (€)": ((r.best_price_htva_cents * (r.moq || 1)) / 100).toFixed(2),
    "URL produit": r.product_slug ? `${window.location.origin}/produit/${r.product_slug}` : "",
  }));
}

export function exportDiscountXlsx(rows: DiscountRow[], ctx: ExportContext) {
  const wb = XLSX.utils.book_new();
  const summary = [
    ["MediKong — Bonnes affaires"],
    ["Exporté le", new Date().toLocaleString("fr-BE")],
    ["Référence prix", ctx.reference === "pvp" ? "PVP conseillé" : "Prix marché"],
    ["Remise minimale (%)", ctx.minDiscountPct],
    ["Pays", ctx.country],
    ["Nombre de lignes", rows.length],
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum["!cols"] = [{ wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Filtres");

  const ws = XLSX.utils.json_to_sheet(rowsToObjects(rows));
  ws["!cols"] = [
    { wch: 40 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 6 },
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Bonnes affaires");
  XLSX.writeFile(wb, `medikong-bonnes-affaires-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportDiscountCsv(rows: DiscountRow[]) {
  const objs = rowsToObjects(rows);
  if (!objs.length) return;
  const headers = Object.keys(objs[0]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(";"),
    ...objs.map((o) => headers.map((h) => escape((o as any)[h])).join(";")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medikong-bonnes-affaires-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
