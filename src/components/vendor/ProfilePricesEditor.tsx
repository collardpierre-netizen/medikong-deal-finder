import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tag, Plus, Trash2, ChevronRight, Loader2 } from "lucide-react";
import ResolvedProfilePricesPreview from "./ResolvedProfilePricesPreview";

type PricingMode = "absolute" | "discount_pct";

interface ProfilePriceRow {
  id?: string;
  buyer_profile_id: string;
  pricing_mode: PricingMode;
  price_excl_vat: string;
  discount_pct: string;
}

const empty = (): ProfilePriceRow => ({
  buyer_profile_id: "",
  pricing_mode: "absolute",
  price_excl_vat: "",
  discount_pct: "0",
});

interface Props {
  offerId: string | null;
  basePrice: number;
}

/**
 * Éditeur de prix HTVA par profil acheteur (référentiel buyer_profiles).
 * Mode au choix par ligne : absolu (€) OU delta % vs prix de base de l'offre.
 * Persiste dans offer_buyer_profile_prices.
 */
export default function ProfilePricesEditor({ offerId, basePrice }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<ProfilePriceRow[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["buyer-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("buyer_profiles" as any)
        .select("id,label,display_order")
        .order("display_order");
      return (data || []) as any[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: existing } = useQuery({
    queryKey: ["offer-buyer-profile-prices", offerId],
    queryFn: async () => {
      if (!offerId) return [];
      const { data } = await supabase
        .from("offer_buyer_profile_prices" as any)
        .select("*")
        .eq("offer_id", offerId);
      return (data || []) as any[];
    },
    enabled: !!offerId,
  });

  useEffect(() => {
    if (existing && existing.length > 0) {
      setRows(existing.map((r: any) => ({
        id: r.id,
        buyer_profile_id: r.buyer_profile_id,
        pricing_mode: (r.pricing_mode as PricingMode) || "absolute",
        price_excl_vat: r.price_excl_vat != null ? String(r.price_excl_vat) : "",
        discount_pct: r.discount_pct != null ? String(r.discount_pct) : "0",
      })));
      setExpanded(true);
    }
  }, [existing]);

  const addRow = () => setRows((p) => [...p, empty()]);
  const removeRow = (idx: number) => setRows((p) => p.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<ProfilePriceRow>) =>
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const resolved = (row: ProfilePriceRow): number => {
    if (row.pricing_mode === "absolute") return parseFloat(row.price_excl_vat) || 0;
    const d = parseFloat(row.discount_pct) || 0;
    return basePrice > 0 ? Math.round(basePrice * (1 - d / 100) * 100) / 100 : 0;
  };

  // Détecte les modifications non sauvegardées (pour badge "Brouillon" du preview)
  const isDirty = useMemo(() => {
    const dbRows = (existing || []) as any[];
    const norm = (r: any) => ({
      buyer_profile_id: r.buyer_profile_id,
      pricing_mode: r.pricing_mode,
      price_excl_vat: r.price_excl_vat != null ? Number(r.price_excl_vat) : null,
      discount_pct: r.discount_pct != null ? Number(r.discount_pct) : null,
    });
    const normDraft = (r: ProfilePriceRow) => ({
      buyer_profile_id: r.buyer_profile_id,
      pricing_mode: r.pricing_mode,
      price_excl_vat: r.pricing_mode === "absolute" ? Number(r.price_excl_vat) || 0 : null,
      discount_pct: r.pricing_mode === "discount_pct" ? Number(r.discount_pct) || 0 : null,
    });
    const a = dbRows.map(norm).sort((x, y) => x.buyer_profile_id.localeCompare(y.buyer_profile_id));
    const b = rows
      .filter((r) => r.buyer_profile_id)
      .map(normDraft)
      .sort((x, y) => x.buyer_profile_id.localeCompare(y.buyer_profile_id));
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [rows, existing]);

  const save = async () => {
    if (!offerId) {
      toast.info("Sauvegardez l'offre d'abord, puis modifiez-la pour ajouter les prix par profil.");
      return;
    }
    // Validation: pas de profil dupliqué
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.buyer_profile_id) continue;
      if (seen.has(r.buyer_profile_id)) {
        toast.error("Un même profil ne peut être défini qu'une fois.");
        return;
      }
      seen.add(r.buyer_profile_id);
      if (r.pricing_mode === "absolute" && !(parseFloat(r.price_excl_vat) >= 0)) {
        toast.error("Prix HTVA invalide pour un mode absolu.");
        return;
      }
      if (r.pricing_mode === "discount_pct") {
        const d = parseFloat(r.discount_pct);
        if (Number.isNaN(d) || d < -100 || d > 100) {
          toast.error("La remise doit être entre -100% et +100%.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      await supabase.from("offer_buyer_profile_prices" as any).delete().eq("offer_id", offerId);
      const payload = rows
        .filter((r) => r.buyer_profile_id)
        .map((r) =>
          r.pricing_mode === "absolute"
            ? {
                offer_id: offerId,
                buyer_profile_id: r.buyer_profile_id,
                pricing_mode: "absolute",
                price_excl_vat: parseFloat(r.price_excl_vat),
                discount_pct: null,
              }
            : {
                offer_id: offerId,
                buyer_profile_id: r.buyer_profile_id,
                pricing_mode: "discount_pct",
                price_excl_vat: null,
                discount_pct: parseFloat(r.discount_pct),
              }
        );
      if (payload.length > 0) {
        const { error } = await supabase.from("offer_buyer_profile_prices" as any).insert(payload as any);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["offer-buyer-profile-prices", offerId] });
      qc.invalidateQueries({ queryKey: ["resolve-offer-price-by-profile", offerId] });
      toast.success("Prix par profil enregistrés");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border rounded-lg" style={{ borderColor: "#E2E8F0" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#F8FAFC] rounded-lg transition-colors"
      >
        <Tag size={14} style={{ color: "#1B5BDA" }} />
        <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>
          Prix HTVA par profil acheteur
        </span>
        {rows.length > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}
          >
            {rows.length} prix
          </span>
        )}
        <ChevronRight
          size={12}
          className={`ml-auto transition-transform ${expanded ? "rotate-90" : ""}`}
          style={{ color: "#8B95A5" }}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[10px]" style={{ color: "#8B95A5" }}>
            Définissez un prix différent par profil acheteur (Pharmacie indépendante, Hôpital, etc.).
            Si aucun prix n'est défini, le prix de base de l'offre s'applique.
          </p>

          {rows.length === 0 && (
            <p className="text-[11px] py-2 text-center" style={{ color: "#8B95A5" }}>
              Aucun prix spécifique. Tous les profils voient le prix de base.
            </p>
          )}

          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1.4fr_0.9fr_1fr_auto_auto] gap-1.5 items-end p-2 rounded-lg"
              style={{ backgroundColor: "#F8FAFC" }}
            >
              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>
                  Profil acheteur *
                </label>
                <select
                  value={row.buyer_profile_id}
                  onChange={(e) => updateRow(idx, { buyer_profile_id: e.target.value })}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white"
                  style={{ borderColor: "#E2E8F0" }}
                >
                  <option value="">Choisir…</option>
                  {profiles.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>
                  Mode
                </label>
                <select
                  value={row.pricing_mode}
                  onChange={(e) => updateRow(idx, { pricing_mode: e.target.value as PricingMode })}
                  className="w-full px-1.5 py-1 text-[11px] border rounded bg-white"
                  style={{ borderColor: "#E2E8F0" }}
                >
                  <option value="absolute">Prix HTVA</option>
                  <option value="discount_pct">% vs base</option>
                </select>
              </div>

              <div>
                {row.pricing_mode === "absolute" ? (
                  <>
                    <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>
                      Prix HTVA (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.price_excl_vat}
                      onChange={(e) => updateRow(idx, { price_excl_vat: e.target.value })}
                      placeholder={basePrice ? basePrice.toFixed(2) : "—"}
                      className="w-full px-1.5 py-1 text-[11px] border rounded bg-white"
                      style={{ borderColor: "#E2E8F0" }}
                    />
                  </>
                ) : (
                  <>
                    <label className="text-[9px] block mb-0.5" style={{ color: "#8B95A5" }}>
                      Remise % (- = remise)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="-100"
                      max="100"
                      value={row.discount_pct}
                      onChange={(e) => updateRow(idx, { discount_pct: e.target.value })}
                      className="w-full px-1.5 py-1 text-[11px] border rounded bg-white"
                      style={{ borderColor: "#E2E8F0" }}
                    />
                  </>
                )}
              </div>

              <div>
                {basePrice > 0 && (
                  <span
                    className="text-[10px] font-semibold whitespace-nowrap"
                    style={{ color: "#059669" }}
                  >
                    → {resolved(row).toFixed(2)} €
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="p-0.5 hover:bg-[#FEF2F2] rounded"
                title="Supprimer"
              >
                <Trash2 size={12} style={{ color: "#EF4343" }} />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#EFF6FF] transition-colors"
              style={{ color: "#1B5BDA" }}
            >
              <Plus size={12} /> Ajouter un profil
            </button>
            {rows.length > 0 && offerId && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-[#EFF6FF] transition-colors disabled:opacity-60"
                style={{ color: "#059669" }}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                Sauvegarder les prix
              </button>
            )}
            {!offerId && rows.length > 0 && (
              <span className="text-[10px]" style={{ color: "#F59E0B" }}>
                ⚠ Créez l'offre d'abord, puis modifiez-la pour sauvegarder les prix
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
