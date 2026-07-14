import * as XLSX from "xlsx";
import { toast } from "sonner";

/** Convert an array of flat objects to CSV (semicolon-separated, Excel FR-friendly). */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(";")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(";"));
  return "\ufeff" + lines.join("\r\n"); // BOM for Excel
}

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAnalyticsRows(
  rows: Record<string, unknown>[],
  filename: string,
  format: "csv" | "xlsx",
  sheetName = "Analytics"
) {
  if (!rows.length) {
    toast.error("Aucune donnée à exporter");
    return;
  }
  if (format === "csv") {
    downloadBlob(toCsv(rows), `${filename}.csv`, "text/csv;charset=utf-8");
  } else {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
  toast.success(`${rows.length} lignes exportées (${format.toUpperCase()})`);
}

/** Export multiple named sheets into a single XLSX (useful for Récurrence: KPIs + cohortes). */
export function exportAnalyticsMultiSheet(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  let total = 0;
  for (const s of sheets) {
    if (!s.rows.length) continue;
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    total += s.rows.length;
  }
  if (total === 0) {
    toast.error("Aucune donnée à exporter");
    return;
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast.success(`${total} lignes exportées (XLSX, ${sheets.length} onglets)`);
}
