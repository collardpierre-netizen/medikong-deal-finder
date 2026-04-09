import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";

const PROFILES = [
  { key: "pharmacy", label: "Pharmacie" },
  { key: "hospital", label: "Hôpital" },
  { key: "nursing_home", label: "Maison de repos" },
  { key: "dentist", label: "Dentiste" },
  { key: "nurse", label: "Infirmier(e)" },
  { key: "veterinary", label: "Vétérinaire" },
  { key: "wholesaler", label: "Grossiste" },
];

const COUNTRIES = [
  { code: "BE", label: "🇧🇪 Belgique" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "LU", label: "🇱🇺 Luxembourg" },
  { code: "NL", label: "🇳🇱 Pays-Bas" },
  { code: "DE", label: "🇩🇪 Allemagne" },
];

interface DefaultRow {
  id?: string;
  profile_type: string;
  country_code: string;
  default_mov: number;
  default_mov_currency: string;
  default_moq: number;
}

export default function VendorProfileDefaults({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<DefaultRow[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-profile-defaults", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_profile_defaults" as any)
        .select("*")
        .eq("vendor_id", vendorId)
        .order("profile_type");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!vendorId,
  });

  useEffect(() => {
    if (data) {
      setRows(data.map((d: any) => ({
        id: d.id,
        profile_type: d.profile_type,
        country_code: d.country_code,
        default_mov: d.default_mov,
        default_mov_currency: d.default_mov_currency,
        default_moq: d.default_moq,
      })));
    }
  }, [data]);

  const addRow = () => {
    const usedCombos = new Set(rows.map(r => `${r.profile_type}|${r.country_code}`));
    let profile = PROFILES[0].key;
    let country = COUNTRIES[0].code;
    for (const p of PROFILES) {
      for (const c of COUNTRIES) {
        if (!usedCombos.has(`${p.key}|${c.code}`)) {
          profile = p.key;
          country = c.code;
          break;
        }
      }
      if (!usedCombos.has(`${profile}|${country}`)) break;
    }
    setRows(prev => [...prev, {
      profile_type: profile,
      country_code: country,
      default_mov: 0,
      default_mov_currency: "EUR",
      default_moq: 1,
    }]);
  };

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: keyof DefaultRow, value: any) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete all existing, then re-insert
      await supabase
        .from("vendor_profile_defaults" as any)
        .delete()
        .eq("vendor_id", vendorId);

      if (rows.length > 0) {
        const payload = rows.map(r => ({
          vendor_id: vendorId,
          profile_type: r.profile_type,
          country_code: r.country_code,
          default_mov: r.default_mov,
          default_mov_currency: r.default_mov_currency,
          default_moq: r.default_moq,
        }));
        const { error } = await supabase
          .from("vendor_profile_defaults" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Règles MOV/MOQ par défaut enregistrées");
      qc.invalidateQueries({ queryKey: ["vendor-profile-defaults", vendorId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1B5BDA" }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>
            MOV & MOQ par défaut par profil
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: "#8B95A5" }}>
            Ces valeurs s'appliquent à toutes vos offres sauf si une règle spécifique est définie au niveau de l'offre.
          </p>
        </div>
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
          style={{ backgroundColor: "#EEF2FF", color: "#1B5BDA", border: "1px solid #BFDBFE" }}
        >
          <Plus size={13} /> Ajouter
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
          <p className="text-[13px]" style={{ color: "#8B95A5" }}>
            Aucune règle par défaut. Cliquez sur "Ajouter" pour définir vos MOV/MOQ par profil.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#8B95A5" }}>Profil</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#8B95A5" }}>Pays</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#8B95A5" }}>MOV (€)</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#8B95A5" }}>MOQ</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td className="px-3 py-2">
                    <select
                      className="w-full px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={row.profile_type}
                      onChange={e => updateRow(idx, "profile_type", e.target.value)}
                    >
                      {PROFILES.map(p => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={row.country_code}
                      onChange={e => updateRow(idx, "country_code", e.target.value)}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0} step={1}
                      className="w-full px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={row.default_mov}
                      onChange={e => updateRow(idx, "default_mov", Number(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={1} step={1}
                      className="w-full px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={row.default_moq}
                      onChange={e => updateRow(idx, "default_moq", Number(e.target.value) || 1)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeRow(idx)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "#1B5BDA" }}
      >
        {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer les règles par défaut
      </button>
    </div>
  );
}
