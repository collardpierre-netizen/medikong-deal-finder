import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deriveBeProvince } from "@/lib/be-postal";

interface CoverageRow {
  province: string;
  totalPharmacies: number;
  covered: number;
  coveragePct: number;
}

/**
 * Couverture pharmacies BE d'un vendeur :
 * pour chaque province, ratio (pharmacies distinctes avec au moins un rapport sell-out du vendeur) / (total pharmacies actives).
 * Pas de dépendance carto — vue agrégée par province.
 */
export function BeCoveragePanel({ vendorId }: { vendorId: string | null }) {
  const pharmacies = useQuery({
    queryKey: ["be-pharmacies-coverage-totals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("be_pharmacies")
        .select("id, province, postal_code")
        .eq("is_active", true)
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as { id: string; province: string | null; postal_code: string | null }[];
    },
  });

  const covered = useQuery({
    queryKey: ["vendor-be-coverage", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_sell_out_reports")
        .select("pharmacy_id")
        .eq("vendor_id", vendorId!)
        .not("pharmacy_id", "is", null);
      if (error) throw error;
      const ids = new Set((data ?? []).map((r: any) => r.pharmacy_id as string));
      return ids;
    },
  });

  const rows = useMemo<CoverageRow[]>(() => {
    if (!pharmacies.data) return [];
    const totals = new Map<string, number>();
    const coveredMap = new Map<string, number>();
    for (const p of pharmacies.data) {
      const province = p.province || deriveBeProvince(p.postal_code) || "Inconnue";
      totals.set(province, (totals.get(province) ?? 0) + 1);
      if (covered.data?.has(p.id)) coveredMap.set(province, (coveredMap.get(province) ?? 0) + 1);
    }
    return Array.from(totals.entries())
      .map(([province, totalPharmacies]) => {
        const c = coveredMap.get(province) ?? 0;
        return {
          province,
          totalPharmacies,
          covered: c,
          coveragePct: totalPharmacies ? (c / totalPharmacies) * 100 : 0,
        };
      })
      .sort((a, b) => b.coveragePct - a.coveragePct || b.totalPharmacies - a.totalPharmacies);
  }, [pharmacies.data, covered.data]);

  const totalPh = rows.reduce((s, r) => s + r.totalPharmacies, 0);
  const totalCov = rows.reduce((s, r) => s + r.covered, 0);
  const globalPct = totalPh ? (totalCov / totalPh) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-2 text-[13px] text-[#616B7C]">
          <MapPin size={14} /> Couverture calculée à partir du référentiel pharmacies BE et des
          rapports sell-out reliés à une pharmacie (pharmacy_id).
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={<Building2 size={14} />} label="Pharmacies BE actives" value={totalPh.toLocaleString("fr-BE")} />
        <KpiCard icon={<Users size={14} />} label="Pharmacies clientes" value={totalCov.toLocaleString("fr-BE")} tone="ok" />
        <KpiCard label="Taux de couverture" value={`${globalPct.toFixed(1)}%`} tone={globalPct > 10 ? "ok" : "warn"} />
      </div>

      <div className="p-5 rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="text-[14px] font-semibold text-[#1D2530] mb-3">Couverture par province</div>
        {pharmacies.isLoading ? (
          <div className="text-[12px] text-[#8B95A5]">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="text-[12px] text-[#8B95A5]">
            Aucune pharmacie en base — importez le référentiel dans{" "}
            <code>/admin/pharmacies-be</code>.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[#8B95A5] border-b border-[#E2E8F0]">
                <th className="py-2">Province</th>
                <th className="text-right">Pharmacies</th>
                <th className="text-right">Clientes</th>
                <th className="text-right">Couverture</th>
                <th className="w-[220px]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.province} className="border-b border-[#F1F5F9]">
                  <td className="py-2">{r.province}</td>
                  <td className="text-right tabular-nums">{r.totalPharmacies.toLocaleString("fr-BE")}</td>
                  <td className="text-right tabular-nums">{r.covered.toLocaleString("fr-BE")}</td>
                  <td className="text-right tabular-nums font-medium">{r.coveragePct.toFixed(1)}%</td>
                  <td>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1C58D9]"
                        style={{ width: `${Math.min(100, r.coveragePct)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  const color = tone === "ok" ? "#047857" : tone === "warn" ? "#B45309" : "#1D2530";
  return (
    <div className="p-4 rounded-[10px] border border-[#E2E8F0] bg-white">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[#8B95A5]">
        {icon}
        {label}
      </div>
      <div className="text-[22px] font-semibold mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
