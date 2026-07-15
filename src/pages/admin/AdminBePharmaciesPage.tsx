import { useState } from "react";
import { Upload, Search, MapPin, Building2, Download, RefreshCw } from "lucide-react";
import {
  useBePharmaciesList,
  useUpsertBePharmacies,
} from "@/hooks/useBePharmacies";
import { parseBePharmaciesXlsx, type ParseBePharmaciesResult } from "@/lib/parseBePharmaciesXlsx";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const BE_PROVINCES = [
  "Bruxelles-Capitale",
  "Brabant wallon",
  "Brabant flamand",
  "Anvers",
  "Limbourg",
  "Liège",
  "Namur",
  "Hainaut",
  "Luxembourg",
  "Flandre orientale",
  "Flandre occidentale",
];

export default function AdminBePharmaciesPage() {
  const [search, setSearch] = useState("");
  const [provinceFilter, setProvinceFilter] = useState<string>("");
  const { data, isLoading } = useBePharmaciesList({ search, limit: 500 });
  const upsert = useUpsertBePharmacies();
  const [parsed, setParsed] = useState<ParseBePharmaciesResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const r = await parseBePharmaciesXlsx(f);
      setParsed(r);
      setFileName(f.name);
      toast({
        title: `${r.rows.length} pharmacie(s) valides`,
        description: `${r.rejected.length} rejetée(s) · ${r.unknownColumns.length} colonne(s) ignorée(s)`,
      });
    } catch (err: any) {
      toast({ title: "Erreur de lecture", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!parsed?.rows.length) return;
    try {
      const n = await upsert.mutateAsync(parsed.rows);
      toast({ title: `${n} pharmacie(s) importée(s) / mises à jour` });
      setParsed(null);
      setFileName(null);
    } catch (err: any) {
      toast({ title: "Erreur d'import", description: err.message, variant: "destructive" });
    }
  }

  async function onBackfill() {
    try {
      const { data, error } = await (supabase.rpc as any)("backfill_sell_out_pharmacy_ids");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast({
        title: `Rapprochement terminé`,
        description: `${row?.updated_count ?? 0} rapport(s) reliés · ${row?.remaining_unmatched ?? 0} sans correspondance`,
      });
    } catch (err: any) {
      toast({ title: "Erreur backfill", description: err.message, variant: "destructive" });
    }
  }

  function onExportCsv() {
    const rows = (data?.rows ?? []).filter(
      (r) => !provinceFilter || r.province === provinceFilter,
    );
    if (!rows.length) {
      toast({ title: "Aucune pharmacie à exporter", variant: "destructive" });
      return;
    }
    const headers = [
      "apb_number",
      "name",
      "address_line1",
      "postal_code",
      "city",
      "province",
      "phone",
      "email",
      "latitude",
      "longitude",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacies-be${provinceFilter ? `-${provinceFilter}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${rows.length} pharmacie(s) exportée(s)` });
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-[24px] font-semibold text-[#1D2530] flex items-center gap-2">
          <Building2 size={22} /> Pharmacies belges
        </h1>
        <p className="text-[13px] text-[#8B95A5] mt-1">
          Référentiel officines (APB/FAGG). Utilisé pour l'autocomplete client dans les rapports sell-in
          manuel des vendeurs.
        </p>
      </div>

      <div className="p-5 rounded-[10px] border border-[#E2E8F0] bg-white space-y-3">
        <div className="text-[14px] font-semibold text-[#1D2530]">Importer un fichier XLSX/CSV</div>
        <div className="text-[12px] text-[#8B95A5]">
          Colonnes reconnues : <code>apb_number</code>, <code>name</code>, <code>address</code>,{" "}
          <code>postal_code</code>, <code>city</code>, <code>province</code>, <code>phone</code>,{" "}
          <code>email</code>, <code>latitude</code>, <code>longitude</code>. Le numéro APB sert de clé
          unique (upsert).
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:bg-[#F8FAFC]">
            <Upload size={14} />
            <span className="text-[12px]">{fileName || "Choisir un fichier"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          </label>
          {busy && <span className="text-[12px] text-[#8B95A5]">Lecture…</span>}
          {parsed && (
            <>
              <span className="text-[12px] text-[#1D2530]">
                {parsed.rows.length} valides · {parsed.rejected.length} rejetées
              </span>
              <button
                onClick={onImport}
                disabled={!parsed.rows.length || upsert.isPending}
                className="px-4 py-2 rounded-[8px] bg-[#1C58D9] text-white text-[13px] font-medium hover:bg-[#164BB9] disabled:opacity-50"
              >
                {upsert.isPending ? "Import…" : `Importer ${parsed.rows.length}`}
              </button>
              <button
                onClick={() => {
                  setParsed(null);
                  setFileName(null);
                }}
                className="px-3 py-2 text-[12px] text-[#8B95A5] hover:text-[#1D2530]"
              >
                Annuler
              </button>
            </>
          )}
        </div>
        {parsed?.unknownColumns.length ? (
          <div className="text-[11px] text-[#B45309]">
            Colonnes ignorées : {parsed.unknownColumns.join(", ")}
          </div>
        ) : null}
        {parsed?.rejected.length ? (
          <details className="text-[11px]">
            <summary className="cursor-pointer text-[#B91C1C]">
              {parsed.rejected.length} ligne(s) rejetée(s)
            </summary>
            <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
              {parsed.rejected.slice(0, 50).map((r) => (
                <li key={r.rowNumber}>
                  #{r.rowNumber} — {r.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="p-5 rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="text-[14px] font-semibold text-[#1D2530]">
            Officines en base ({data?.count ?? 0})
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom, APB, ville, CP…"
              className="pl-8 pr-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[12px] w-[280px]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[#8B95A5] border-b border-[#E2E8F0]">
                <th className="py-2">APB</th>
                <th>Nom</th>
                <th>CP</th>
                <th>Ville</th>
                <th>Province</th>
                <th className="text-right">Géo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#8B95A5]">
                    Chargement…
                  </td>
                </tr>
              )}
              {!isLoading && !data?.rows.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#8B95A5]">
                    Aucune pharmacie. Importez un fichier XLSX/CSV pour commencer.
                  </td>
                </tr>
              )}
              {(data?.rows ?? []).map((p) => (
                <tr key={p.id} className="border-b border-[#F1F5F9]">
                  <td className="py-2 font-mono">{p.apb_number}</td>
                  <td>{p.name}</td>
                  <td>{p.postal_code || "—"}</td>
                  <td>{p.city || "—"}</td>
                  <td>{p.province || "—"}</td>
                  <td className="text-right">
                    {p.latitude != null && p.longitude != null ? (
                      <MapPin size={12} className="inline text-[#047857]" />
                    ) : (
                      <span className="text-[#CBD5E1]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
