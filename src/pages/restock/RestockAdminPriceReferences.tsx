import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Database, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";

export default function RestockAdminPriceReferences() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: refs = [], isLoading } = useQuery({
    queryKey: ["price-references", search],
    queryFn: async () => {
      let q = supabase.from("price_references").select("*").order("designation").limit(200);
      if (search.trim()) {
        q = q.or(`ean.ilike.%${search}%,cnk.ilike.%${search}%,designation.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const importCSV = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      const inserts = rows.map((r) => {
        const pp = Number(r.public_price_eur || r["Prix public"] || 0);
        const vatRate = Number(r.vat_rate || r["TVA"] || 21);
        const isRx = vatRate === 6;
        const ratio = isRx ? 0.69 : 0.55;
        const pharmacistPrice = Math.round(pp * ratio / (1 + vatRate / 100) * 100) / 100;

        return {
          ean: String(r.ean || r.EAN || "").trim() || null,
          cnk: String(r.cnk || r.CNK || "").trim() || null,
          designation: String(r.designation || r["Désignation"] || r.Designation || "").trim(),
          category: String(r.category || r["Catégorie"] || "").trim() || null,
          public_price_eur: pp || null,
          pharmacist_price_estimated_eur: pharmacistPrice || null,
          vat_rate: vatRate,
          source: String(r.source || "manual").trim(),
        };
      }).filter((r) => r.designation && (r.ean || r.cnk));

      // Upsert in batches of 50
      let count = 0;
      for (let i = 0; i < inserts.length; i += 50) {
        const batch = inserts.slice(i, i + 50);
        const { error } = await supabase.from("price_references").upsert(batch, { onConflict: "ean" });
        if (error) throw error;
        count += batch.length;
      }

      toast.success(`${count} références importées`);
      qc.invalidateQueries({ queryKey: ["price-references"] });
    } catch (err) {
      toast.error("Erreur d'import");
    } finally {
      setImporting(false);
    }
  }, [qc]);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["ean", "cnk", "designation", "category", "public_price_eur", "vat_rate", "source"],
      ["5410063011027", "0031-102", "Dafalgan 500mg 30 comp", "Analgésiques", 4.50, 6, "cbip"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PriceRef");
    XLSX.writeFile(wb, "MediKong_PriceReferences_Template.xlsx");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database size={24} className="text-[#1C58D9]" />
          <h1 className="text-2xl font-bold text-[#1E252F]">Référentiel Prix (CBIP)</h1>
          <Badge variant="outline">{refs.length} entrées</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2 text-[#1C58D9] border-[#D0D5DC]">
            <Download size={16} /> Template
          </Button>
          <label>
            <Button asChild className="bg-[#1C58D9] hover:bg-[#1549B8] text-white gap-2 cursor-pointer" disabled={importing}>
              <span>
                {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                Importer CSV/XLSX
              </span>
            </Button>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
        <Input
          placeholder="Rechercher par EAN, CNK ou désignation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-[#D0D5DC] rounded-lg max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : (
        <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F8FA] text-[#5C6470]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">EAN</th>
                <th className="text-left px-4 py-3 font-medium">CNK</th>
                <th className="text-left px-4 py-3 font-medium">Désignation</th>
                <th className="text-left px-4 py-3 font-medium">Catégorie</th>
                <th className="text-right px-4 py-3 font-medium">PP (€)</th>
                <th className="text-right px-4 py-3 font-medium">Prix pharma. est.</th>
                <th className="text-center px-4 py-3 font-medium">TVA</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {refs.map((r: any) => (
                <tr key={r.id} className="border-t border-[#D0D5DC]/50 hover:bg-[#F7F8FA]/50">
                  <td className="px-4 py-2.5 font-mono text-[#1E252F]">{r.ean || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-[#5C6470]">{r.cnk || "—"}</td>
                  <td className="px-4 py-2.5 text-[#1E252F]">{r.designation}</td>
                  <td className="px-4 py-2.5 text-[#8B929C]">{r.category || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{r.public_price_eur ? `${Number(r.public_price_eur).toFixed(2)} €` : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-[#1C58D9] font-medium">{r.pharmacist_price_estimated_eur ? `${Number(r.pharmacist_price_estimated_eur).toFixed(2)} €` : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant="outline" className="text-[10px]">{r.vat_rate}%</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-[#8B929C]">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
