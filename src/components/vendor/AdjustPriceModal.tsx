import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingDown, Equal, Sparkles, Loader2 } from "lucide-react";
import { useVendorCommissionConfig } from "@/hooks/useVendorCommissionConfig";
import { computeMargin } from "@/lib/vendorMargin";
import { MarginInsightCard } from "@/components/vendor/MarginInsightCard";
import { MarginBreakdownDetails } from "@/components/vendor/MarginBreakdownDetails";

export interface AdjustPriceContext {
  offerId: string;
  productName: string;
  gtin?: string | null;
  myPrice: number;
  bestMkPrice?: number | null;
  bestExtPrice?: number | null;
  vatRate?: number; // default 0.06 (BE meds) — used to refresh price_incl_vat
  /** Required to compute net margin / commission breakdown */
  vendorId?: string | null;
  /** Required to load the vendor's purchase price (override + default) */
  productId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: AdjustPriceContext | null;
  /** Optional list of query keys to invalidate after a successful update */
  invalidateKeys?: (string | undefined)[][];
  /**
   * Called whenever the user types a new price (parsed, HTVA in €, or null when invalid/empty).
   * Lets the parent popup recompute "Mon offre — marge & commission MediKong" in real time
   * even before the user confirms the new price.
   */
  onPriceChange?: (newPriceExclVat: number | null) => void;
  /**
   * Called once the price has been successfully persisted, with the previous and the new
   * HTVA prices. Used by the parent to render an "Avant / Après" comparison.
   */
  onPriceSaved?: (oldPriceExclVat: number, newPriceExclVat: number) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toFixed(2)} €` : "—";

export function AdjustPriceModal({ open, onOpenChange, ctx, invalidateKeys, onPriceChange, onPriceSaved }: Props) {
  const qc = useQueryClient();
  const [newPrice, setNewPrice] = useState<string>("");

  // Vendor commission config (used to compute net & margin breakdown live)
  const { data: commissionConfig } = useVendorCommissionConfig(ctx?.vendorId ?? null);

  // Vendor's purchase price for this product (offer override > vendor default)
  const { data: purchasePrice } = useQuery({
    enabled: !!ctx?.offerId && !!ctx?.vendorId && !!ctx?.productId,
    queryKey: ["vendor-purchase-price", ctx?.offerId, ctx?.vendorId, ctx?.productId],
    queryFn: async (): Promise<number | null> => {
      if (!ctx?.offerId || !ctx?.vendorId || !ctx?.productId) return null;
      const [{ data: offer }, { data: dflt }] = await Promise.all([
        supabase.from("offers").select("purchase_price_excl_vat").eq("id", ctx.offerId).maybeSingle(),
        supabase
          .from("vendor_product_costs")
          .select("default_purchase_price_excl_vat")
          .eq("vendor_id", ctx.vendorId)
          .eq("product_id", ctx.productId)
          .maybeSingle(),
      ]);
      const o = (offer as any)?.purchase_price_excl_vat;
      if (o != null) return Number(o);
      const d = (dflt as any)?.default_purchase_price_excl_vat;
      if (d != null) return Number(d);
      return null;
    },
  });

  // Lowest competing price (across MK and external)
  const lowestCompetitor = useMemo(() => {
    if (!ctx) return null;
    const candidates = [ctx.bestMkPrice, ctx.bestExtPrice].filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    if (candidates.length === 0) return null;
    return Math.min(...candidates);
  }, [ctx]);

  useEffect(() => {
    if (open && ctx) setNewPrice(ctx.myPrice.toFixed(2));
  }, [open, ctx]);

  // Push every typed price up to the parent so it can refresh its own
  // "Mon offre — marge & commission MediKong" panel live, without waiting
  // for the user to confirm.
  useEffect(() => {
    if (!onPriceChange) return;
    if (!open) {
      onPriceChange(null);
      return;
    }
    const n = Number(newPrice);
    onPriceChange(Number.isFinite(n) && n > 0 ? n : null);
  }, [newPrice, open, onPriceChange]);

  const update = useMutation({
    mutationFn: async (priceExcl: number) => {
      if (!ctx) throw new Error("Aucune offre sélectionnée");
      const vat = ctx.vatRate ?? 0.06;
      const priceIncl = round2(priceExcl * (1 + vat));
      const oldPrice = ctx.myPrice;
      const { error } = await supabase
        .from("offers")
        .update({
          price_excl_vat: priceExcl,
          price_incl_vat: priceIncl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ctx.offerId);
      if (error) throw error;
      return { oldPrice, newPrice: priceExcl };
    },
    onSuccess: ({ oldPrice, newPrice }) => {
      toast.success("Prix mis à jour", {
        description: `Nouveau prix : ${newPrice.toFixed(2)} € HTVA`,
      });
      onPriceSaved?.(oldPrice, newPrice);

      // ── Patch chirurgical du cache ─────────────────────────────────────
      // Plutôt que d'invalider TOUTES les queries (refetch coûteux d'un RPC
      // qui agrège l'ensemble du catalogue vendeur), on met à jour localement
      // uniquement la ligne dont l'offre vient de changer.
      const vat = ctx?.vatRate ?? 0.06;
      const priceIncl = round2(newPrice * (1 + vat));
      const offerId = ctx?.offerId;
      const vendorId = ctx?.vendorId;
      const productId = ctx?.productId;

      // 1) ["vendor-market-intel", vendorId] : patch in-place de la row
      //    correspondante + de l'entrée "is_mine" dans medikong_offers
      if (offerId && vendorId) {
        qc.setQueriesData<any[]>({ queryKey: ["vendor-market-intel", vendorId] }, (old) => {
          if (!Array.isArray(old)) return old;
          let touched = false;
          const next = old.map((row: any) => {
            if (row?.my_offer_id !== offerId) return row;
            touched = true;
            const patchedOffers = Array.isArray(row.medikong_offers)
              ? row.medikong_offers.map((o: any) =>
                  o?.is_mine
                    ? { ...o, price_excl_vat: newPrice, updated_at: new Date().toISOString() }
                    : o,
                )
              : row.medikong_offers;
            return {
              ...row,
              my_price_excl_vat: newPrice,
              my_updated_at: new Date().toISOString(),
              medikong_offers: patchedOffers,
            };
          });
          return touched ? next : old;
        });
      }

      // 2) ["offers", ...] / ["vendor-offers", ...] : patch des listes en cache
      //    contenant cet offer.id (ou des objets de type { offers: [...] }).
      const patchOfferList = (list: any[]): any[] =>
        list.map((it: any) => {
          if (!it) return it;
          if (it.id === offerId) {
            return {
              ...it,
              price_excl_vat: newPrice,
              price_incl_vat: priceIncl,
              updated_at: new Date().toISOString(),
            };
          }
          if (Array.isArray(it.offers)) {
            return { ...it, offers: patchOfferList(it.offers) };
          }
          return it;
        });

      ["offers", "vendor-offers"].forEach((key) => {
        qc.setQueriesData<any>({ queryKey: [key] }, (old) => {
          if (Array.isArray(old)) return patchOfferList(old);
          if (old && typeof old === "object") {
            // Objets paginés type { rows: [...] } ou { data: [...] }
            if (Array.isArray((old as any).rows)) {
              return { ...(old as any), rows: patchOfferList((old as any).rows) };
            }
            if (Array.isArray((old as any).data)) {
              return { ...(old as any), data: patchOfferList((old as any).data) };
            }
            // Cas single-row : { id, ...offer }
            if ((old as any).id === offerId) {
              return {
                ...(old as any),
                price_excl_vat: newPrice,
                price_incl_vat: priceIncl,
                updated_at: new Date().toISOString(),
              };
            }
          }
          return old;
        });
      });

      // 3) Invalidations *passives* : on marque "stale" sans refetch immédiat.
      //    Elles seront re-fetchées naturellement au prochain mount/focus si
      //    nécessaire — pas de surcharge réseau pour la session courante.
      qc.invalidateQueries({ queryKey: ["vendor-market-intel"], refetchType: "none" });
      qc.invalidateQueries({ queryKey: ["offers"], refetchType: "none" });
      qc.invalidateQueries({ queryKey: ["vendor-offers"], refetchType: "none" });

      // 4) Caches consommateurs (alertes, historique offres, etc.) déclarés
      //    par l'appelant : on garde le comportement actif de refetch (le
      //    parent sait quels caches ont vraiment besoin d'être resynchronisés).
      if (productId) {
        // Le snapshot d'audit (offer_margin_snapshots) est inséré côté DB
        // par trigger : on rafraîchit uniquement la "dernière trace" affichée
        // dans MarginBreakdownDetails pour cette offre précise.
        qc.invalidateQueries({ queryKey: ["offer-margin-last-snapshot", offerId] });
      }
      (invalidateKeys || []).forEach((k) => {
        qc.invalidateQueries({ queryKey: k.filter(Boolean) as string[] });
      });

      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error("Échec de la mise à jour", { description: e?.message });
    },
  });

  if (!ctx) return null;

  const parsed = Number(newPrice);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const delta = valid ? parsed - ctx.myPrice : 0;
  const deltaPct = valid && ctx.myPrice > 0 ? (delta / ctx.myPrice) * 100 : 0;

  const align = () => lowestCompetitor && setNewPrice(lowestCompetitor.toFixed(2));
  const beat1 = () => lowestCompetitor && setNewPrice(round2(lowestCompetitor * 0.99).toFixed(2));
  const beat3 = () => lowestCompetitor && setNewPrice(round2(lowestCompetitor * 0.97).toFixed(2));

  // Helper: net en poche pour une suggestion (utilisé sur les boutons rapides)
  const netForPrice = (p: number): number | null => {
    if (!commissionConfig) return null;
    return computeMargin(p, purchasePrice ?? null, commissionConfig).netRevenue;
  };
  const fmtNet = (p: number) => {
    const n = netForPrice(p);
    return n != null ? `Net ${n.toFixed(2)} €` : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Ajuster mon prix</DialogTitle>
          <DialogDescription className="text-xs">
            {ctx.productName}
            {ctx.gtin && <span className="block text-muted-foreground">EAN {ctx.gtin}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Concurrence summary */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border p-2.5">
              <div className="text-[10px] uppercase text-muted-foreground">Mon prix</div>
              <div className="font-semibold tabular-nums">{fmt(ctx.myPrice)}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-[10px] uppercase text-muted-foreground">Meilleur MK</div>
              <div className="font-semibold tabular-nums">{fmt(ctx.bestMkPrice)}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-[10px] uppercase text-muted-foreground">Meilleur ext.</div>
              <div className="font-semibold tabular-nums">{fmt(ctx.bestExtPrice)}</div>
            </div>
          </div>

          {/* Quick actions */}
          {lowestCompetitor != null && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                Suggestions rapides
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={align}
                  className="flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs hover:bg-muted/40 transition-colors"
                >
                  <Equal size={14} className="text-blue-600" />
                  <span className="font-medium">Aligner</span>
                  <span className="tabular-nums text-muted-foreground">
                    {lowestCompetitor.toFixed(2)} €
                  </span>
                  {fmtNet(lowestCompetitor) && (
                    <span className="text-[10px] tabular-nums text-blue-700 font-medium">
                      {fmtNet(lowestCompetitor)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={beat1}
                  className="flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs hover:bg-muted/40 transition-colors"
                >
                  <TrendingDown size={14} className="text-emerald-600" />
                  <span className="font-medium">−1 %</span>
                  <span className="tabular-nums text-muted-foreground">
                    {round2(lowestCompetitor * 0.99).toFixed(2)} €
                  </span>
                  {fmtNet(round2(lowestCompetitor * 0.99)) && (
                    <span className="text-[10px] tabular-nums text-blue-700 font-medium">
                      {fmtNet(round2(lowestCompetitor * 0.99))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={beat3}
                  className="flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs hover:bg-muted/40 transition-colors"
                >
                  <Sparkles size={14} className="text-amber-600" />
                  <span className="font-medium">−3 %</span>
                  <span className="tabular-nums text-muted-foreground">
                    {round2(lowestCompetitor * 0.97).toFixed(2)} €
                  </span>
                  {fmtNet(round2(lowestCompetitor * 0.97)) && (
                    <span className="text-[10px] tabular-nums text-blue-700 font-medium">
                      {fmtNet(round2(lowestCompetitor * 0.97))}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Manual input */}
          <div className="space-y-1.5">
            <Label htmlFor="new-price" className="text-xs">
              Nouveau prix HTVA (€)
            </Label>
            <Input
              id="new-price"
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="tabular-nums"
            />
            {valid && delta !== 0 && (
              <div
                className={`text-[11px] tabular-nums ${
                  delta < 0 ? "text-emerald-600" : "text-orange-600"
                }`}
              >
                {delta < 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(2)} € (
                {deltaPct.toFixed(1)}%) vs prix actuel
              </div>
            )}
          </div>

          {/* Margin & commission breakdown for the proposed price */}
          {valid && commissionConfig && (
            <>
              <MarginInsightCard
                breakdown={computeMargin(parsed, purchasePrice ?? null, commissionConfig)}
                commissionModel={commissionConfig.commission_model}
                compact
              />
              <MarginBreakdownDetails
                breakdown={computeMargin(parsed, purchasePrice ?? null, commissionConfig)}
                commissionModel={commissionConfig.commission_model}
                commissionRate={commissionConfig.commission_rate}
                marginSplitPct={commissionConfig.margin_split_pct}
                fixedCommissionAmount={commissionConfig.fixed_commission_amount}
                offerId={ctx.offerId}
              />
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs px-3 py-2 rounded-md hover:bg-muted/40"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!valid || update.isPending || parsed === ctx.myPrice}
              onClick={() => update.mutate(parsed)}
              className="text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {update.isPending && <Loader2 size={12} className="animate-spin" />}
              Confirmer le nouveau prix
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
