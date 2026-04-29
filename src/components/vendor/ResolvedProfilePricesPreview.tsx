import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Loader2 } from "lucide-react";

type PricingMode = "absolute" | "discount_pct";

interface DraftRow {
  buyer_profile_id: string;
  pricing_mode: PricingMode;
  price_excl_vat: string;
  discount_pct: string;
}

interface BuyerProfile {
  id: string;
  label: string;
}

interface Props {
  offerId: string | null;
  basePrice: number;
  drafts: DraftRow[];
  profiles: BuyerProfile[];
  /** Considère qu'il y a des modifications non sauvegardées par rapport à la DB. */
  isDirty: boolean;
}

interface ResolvedRow {
  profile_id: string;
  profile_label: string;
  price: number | null;
  source: "draft_absolute" | "draft_discount" | "offer_absolute" | "offer_discount" | "vendor_default_absolute" | "vendor_default_discount" | "offer_base" | "unknown";
  isDraft: boolean;
}

const SOURCE_META: Record<ResolvedRow["source"], { label: string; bg: string; fg: string }> = {
  draft_absolute:          { label: "Brouillon (prix)",        bg: "#FEF3C7", fg: "#92400E" },
  draft_discount:          { label: "Brouillon (% remise)",    bg: "#FEF3C7", fg: "#92400E" },
  offer_absolute:          { label: "Override offre (prix)",   bg: "#DBEAFE", fg: "#1E40AF" },
  offer_discount:          { label: "Override offre (%)",      bg: "#DBEAFE", fg: "#1E40AF" },
  vendor_default_absolute: { label: "Défaut vendeur (prix)",   bg: "#E0E7FF", fg: "#3730A3" },
  vendor_default_discount: { label: "Défaut vendeur (%)",      bg: "#E0E7FF", fg: "#3730A3" },
  offer_base:              { label: "Prix de base",            bg: "#F1F5F9", fg: "#475569" },
  unknown:                 { label: "—",                       bg: "#F1F5F9", fg: "#94A3B8" },
};

/**
 * Aperçu live "prix HTVA résolu par profil" pour le vendeur.
 *
 * Pour chaque profil acheteur, affiche le prix HTVA effectivement servi via la
 * cascade officielle (RPC `resolve_offer_price_for_profile`) : override offre →
 * défaut vendeur → prix de base. Si une ligne brouillon (non sauvegardée)
 * existe pour ce profil, elle remplace l'affichage par un preview local + badge
 * "Brouillon" pour matérialiser l'écart entre l'éditeur et la DB.
 */
export default function ResolvedProfilePricesPreview({
  offerId,
  basePrice,
  drafts,
  profiles,
  isDirty,
}: Props) {
  // Map des drafts par profil (dernier gagne si doublon UI)
  const draftByProfile = useMemo(() => {
    const m = new Map<string, DraftRow>();
    for (const d of drafts) {
      if (d.buyer_profile_id) m.set(d.buyer_profile_id, d);
    }
    return m;
  }, [drafts]);

  // Appel RPC en parallèle pour chaque profil — résout depuis la DB (offre + défauts vendeur)
  const { data: resolvedFromDb = [], isLoading } = useQuery({
    queryKey: ["resolve-offer-price-by-profile", offerId, profiles.map((p) => p.id).join(",")],
    queryFn: async () => {
      if (!offerId || profiles.length === 0) return [];
      const results = await Promise.all(
        profiles.map(async (p) => {
          const { data, error } = await supabase.rpc("resolve_offer_price_for_profile" as any, {
            _offer_id: offerId,
            _buyer_profile_id: p.id,
          });
          if (error || !data || (Array.isArray(data) && data.length === 0)) {
            return { profile_id: p.id, price: null as number | null, source: "unknown" as const };
          }
          const row = Array.isArray(data) ? (data[0] as any) : (data as any);
          return {
            profile_id: p.id,
            price: row?.price_excl_vat != null ? Number(row.price_excl_vat) : null,
            source: (row?.source as ResolvedRow["source"]) || "unknown",
          };
        })
      );
      return results;
    },
    enabled: !!offerId && profiles.length > 0,
    staleTime: 10 * 1000,
  });

  const dbByProfile = useMemo(() => {
    const m = new Map<string, { price: number | null; source: ResolvedRow["source"] }>();
    for (const r of resolvedFromDb) m.set(r.profile_id, { price: r.price, source: r.source });
    return m;
  }, [resolvedFromDb]);

  const rows: ResolvedRow[] = useMemo(() => {
    return profiles.map((p) => {
      const draft = draftByProfile.get(p.id);
      if (draft) {
        if (draft.pricing_mode === "absolute") {
          const v = parseFloat(draft.price_excl_vat);
          return {
            profile_id: p.id,
            profile_label: p.label,
            price: Number.isFinite(v) ? v : null,
            source: "draft_absolute",
            isDraft: true,
          };
        }
        const d = parseFloat(draft.discount_pct) || 0;
        const v = basePrice > 0 ? Math.round(basePrice * (1 - d / 100) * 100) / 100 : null;
        return {
          profile_id: p.id,
          profile_label: p.label,
          price: v,
          source: "draft_discount",
          isDraft: true,
        };
      }
      const db = dbByProfile.get(p.id);
      return {
        profile_id: p.id,
        profile_label: p.label,
        price: db?.price ?? (basePrice > 0 ? basePrice : null),
        source: db?.source ?? (basePrice > 0 ? "offer_base" : "unknown"),
        isDraft: false,
      };
    });
  }, [profiles, draftByProfile, dbByProfile, basePrice]);

  if (!offerId) {
    return (
      <div className="text-[10px] px-2 py-2 rounded" style={{ backgroundColor: "#FFF7ED", color: "#9A3412" }}>
        Sauvegardez l'offre une première fois pour voir l'aperçu des prix résolus par profil.
      </div>
    );
  }

  return (
    <div className="border rounded-lg" style={{ borderColor: "#E2E8F0", backgroundColor: "#FAFBFC" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "#E2E8F0" }}>
        <Eye size={13} style={{ color: "#1B5BDA" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#1D2530" }}>
          Aperçu : prix HTVA résolu par profil
        </span>
        {isLoading && <Loader2 size={11} className="animate-spin" style={{ color: "#8B95A5" }} />}
        {isDirty && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-medium ml-auto"
            style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
          >
            Brouillon affiché
          </span>
        )}
      </div>

      <div className="divide-y" style={{ borderColor: "#E2E8F0" }}>
        {rows.map((r) => {
          const meta = SOURCE_META[r.source];
          const delta =
            r.price != null && basePrice > 0 && r.price !== basePrice
              ? ((r.price - basePrice) / basePrice) * 100
              : null;
          return (
            <div
              key={r.profile_id}
              className="grid grid-cols-[1.5fr_auto_auto_auto] gap-3 items-center px-3 py-1.5"
            >
              <span className="text-[11px]" style={{ color: "#1D2530" }}>
                {r.profile_label}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
                style={{ backgroundColor: meta.bg, color: meta.fg }}
              >
                {meta.label}
              </span>
              {delta != null ? (
                <span
                  className="text-[10px] font-medium tabular-nums whitespace-nowrap"
                  style={{ color: delta < 0 ? "#059669" : "#DC2626" }}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>
                  =
                </span>
              )}
              <span
                className="text-[12px] font-bold tabular-nums whitespace-nowrap text-right"
                style={{ color: r.price != null ? "#1D2530" : "#94A3B8" }}
              >
                {r.price != null ? `${r.price.toFixed(2)} €` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t text-[9px]" style={{ borderColor: "#E2E8F0", color: "#8B95A5" }}>
        Cascade : override offre → défaut vendeur → prix de base ({basePrice > 0 ? `${basePrice.toFixed(2)} €` : "non défini"}).
      </div>
    </div>
  );
}
