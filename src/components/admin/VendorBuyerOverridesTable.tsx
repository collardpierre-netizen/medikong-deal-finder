import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Trash2, Plus, X } from "lucide-react";

interface OverrideRow {
  id: string;
  vendor_id: string;
  buyer_account_id: string;
  default_mov: number | null;
  default_moq: number | null;
  notes: string | null;
  is_active: boolean;
  customer?: { id: string; name: string | null; email: string | null; country_code: string | null; customer_type: string | null } | null;
}

interface CustomerLite {
  id: string;
  name: string | null;
  email: string | null;
  country_code: string | null;
  customer_type: string | null;
}

export default function VendorBuyerOverridesTable({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { mov?: string; moq?: string; notes?: string; is_active?: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ["vendor-buyer-overrides", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_buyer_overrides" as any)
        .select("*, customer:buyer_account_id(id, name, email, country_code, customer_type)")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OverrideRow[];
    },
    enabled: !!vendorId,
  });

  const { data: pickerResults = [], isFetching: pickerLoading } = useQuery({
    queryKey: ["override-customer-picker", pickerSearch],
    queryFn: async () => {
      const q = pickerSearch.trim();
      let query = supabase.from("customers").select("id, name, email, country_code, customer_type").limit(20);
      if (q) {
        query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
      } else {
        query = query.order("created_at", { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerLite[];
    },
    enabled: pickerOpen,
    staleTime: 30 * 1000,
  });

  const existingBuyerIds = useMemo(
    () => new Set(overrides.filter(o => o.is_active).map(o => o.buyer_account_id)),
    [overrides]
  );

  const addOverride = useMutation({
    mutationFn: async (buyerAccountId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("vendor_buyer_overrides" as any).insert({
        vendor_id: vendorId,
        buyer_account_id: buyerAccountId,
        default_mov: null,
        default_moq: null,
        is_active: true,
        created_by: userRes.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Surcharge ajoutée");
      setPickerOpen(false);
      setPickerSearch("");
      qc.invalidateQueries({ queryKey: ["vendor-buyer-overrides", vendorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveOverride = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("vendor_buyer_overrides" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Surcharge mise à jour");
      setEdits(prev => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["vendor-buyer-overrides", vendorId] });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSavingId(null),
  });

  const deleteOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_buyer_overrides" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Surcharge supprimée");
      qc.invalidateQueries({ queryKey: ["vendor-buyer-overrides", vendorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-[#1B5BDA]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[13px] font-semibold text-[#1D2530]">Surcharges par compte acheteur</h4>
          <p className="text-[11px] text-[#8B95A5] mt-0.5">
            Override MOV / MOQ spécifique à un client final (ex. contrat grand compte). Prime sur les défauts profil × pays.
          </p>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
          style={{ backgroundColor: "#1B5BDA" }}
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border max-h-[420px] overflow-y-auto" style={{ borderColor: "#E2E8F0" }}>
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[#F8FAFC] z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5]">Acheteur</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5] w-28">MOV (€)</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5] w-24">MOQ</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5]">Notes</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5] w-20">Actif</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {overrides.map(o => {
              const edit = edits[o.id] || {};
              const movVal = edit.mov ?? (o.default_mov?.toString() ?? "");
              const moqVal = edit.moq ?? (o.default_moq?.toString() ?? "");
              const notesVal = edit.notes ?? (o.notes ?? "");
              const activeVal = edit.is_active ?? o.is_active;
              const dirty =
                edit.mov !== undefined ||
                edit.moq !== undefined ||
                edit.notes !== undefined ||
                (edit.is_active !== undefined && edit.is_active !== o.is_active);
              return (
                <tr key={o.id} className="border-t" style={{ borderColor: "#E2E8F0" }}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#1D2530] truncate max-w-[220px]" title={o.customer?.name || ""}>
                      {o.customer?.name || "—"}
                    </div>
                    <div className="text-[10px] text-[#8B95A5]">
                      {o.customer?.email || ""}{o.customer?.country_code ? ` · ${o.customer.country_code}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="—"
                      className="w-24 px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={movVal}
                      onChange={e => setEdits(p => ({ ...p, [o.id]: { ...p[o.id], mov: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="—"
                      className="w-20 px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={moqVal}
                      onChange={e => setEdits(p => ({ ...p, [o.id]: { ...p[o.id], moq: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      placeholder="Raison commerciale…"
                      className="w-full px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={notesVal}
                      onChange={e => setEdits(p => ({ ...p, [o.id]: { ...p[o.id], notes: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={activeVal}
                      onChange={e => setEdits(p => ({ ...p, [o.id]: { ...p[o.id], is_active: e.target.checked } }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        disabled={!dirty || savingId === o.id}
                        onClick={() => {
                          const patch: any = {};
                          if (edit.mov !== undefined) patch.default_mov = edit.mov === "" ? null : Math.max(0, Number(edit.mov));
                          if (edit.moq !== undefined) patch.default_moq = edit.moq === "" ? null : Math.max(1, Number(edit.moq));
                          if (edit.notes !== undefined) patch.notes = edit.notes || null;
                          if (edit.is_active !== undefined) patch.is_active = edit.is_active;
                          if (patch.default_mov !== undefined && patch.default_mov !== null && !Number.isFinite(patch.default_mov)) {
                            toast.error("MOV invalide"); return;
                          }
                          if (patch.default_moq !== undefined && patch.default_moq !== null && !Number.isFinite(patch.default_moq)) {
                            toast.error("MOQ invalide"); return;
                          }
                          setSavingId(o.id);
                          saveOverride.mutate({ id: o.id, patch });
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-white disabled:opacity-40"
                        style={{ backgroundColor: "#1B5BDA" }}
                      >
                        {savingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Supprimer cette surcharge ?")) deleteOverride.mutate(o.id);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-[#DC2626] hover:bg-red-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {overrides.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-[#8B95A5]">
                  Aucune surcharge. Cliquez sur « Ajouter » pour cibler un compte acheteur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#8B95A5]">
        Cascade MOV : <strong>surcharge acheteur</strong> &gt; défaut profil × pays &gt; MOV vendeur &gt; fallback 500 €.
        Laissez un champ vide pour utiliser le niveau du dessous.
      </p>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPickerOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-[14px] text-[#1D2530]">Choisir un compte acheteur</h4>
              <button onClick={() => setPickerOpen(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Rechercher par nom ou email…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none mb-3"
              style={{ borderColor: "#E2E8F0" }}
            />
            <div className="max-h-80 overflow-y-auto space-y-1">
              {pickerLoading && <div className="text-[12px] text-[#8B95A5] py-4 text-center">Recherche…</div>}
              {!pickerLoading && pickerResults.length === 0 && (
                <div className="text-[12px] text-[#8B95A5] py-4 text-center">Aucun résultat.</div>
              )}
              {pickerResults.map(c => {
                const already = existingBuyerIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    disabled={already || addOverride.isPending}
                    onClick={() => addOverride.mutate(c.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed border"
                    style={{ borderColor: "#E2E8F0" }}
                  >
                    <div className="font-medium text-[12px] text-[#1D2530]">{c.name || "(sans nom)"}</div>
                    <div className="text-[10px] text-[#8B95A5]">
                      {c.email}{c.country_code ? ` · ${c.country_code}` : ""}{c.customer_type ? ` · ${c.customer_type}` : ""}
                      {already && " · déjà ciblé"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
