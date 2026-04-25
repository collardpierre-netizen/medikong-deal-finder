import { useState } from "react";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import {
  useVendorCompetitorAlerts,
  useMarkAlertSeen,
  useDismissAlert,
  useAdjustOfferPrice,
  type VendorCompetitorAlert,
} from "@/hooks/useVendorCompetitorAlerts";
import { VCard } from "@/components/vendor/ui/VCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, ArrowDown, CheckCircle, Loader2, Search, Target, TrendingDown, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function rankLabel(rank: number) {
  if (rank === 1) return "1ᵉʳ";
  return `${rank}ᵉ`;
}

export default function VendorCompetitorAlerts() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;
  const { data: alerts = [], isLoading } = useVendorCompetitorAlerts(vendorId);
  const markSeen = useMarkAlertSeen();
  const dismiss = useDismissAlert();
  const adjust = useAdjustOfferPrice();

  const [search, setSearch] = useState("");
  const [adjustOpen, setAdjustOpen] = useState<VendorCompetitorAlert | null>(null);
  const [newPrice, setNewPrice] = useState("");

  const filtered = alerts.filter((a) =>
    !search ||
    a.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.product?.gtin?.includes(search)
  );

  const newCount = alerts.filter((a) => a.status === "new").length;
  const criticalCount = alerts.filter((a) => a.gap_percentage >= 10).length;

  const openAdjust = (a: VendorCompetitorAlert) => {
    setAdjustOpen(a);
    setNewPrice(a.suggested_price?.toFixed(2) || "");
    if (a.status === "new") markSeen.mutate(a.id);
  };

  const confirmAdjust = async () => {
    if (!adjustOpen) return;
    const price = Number(newPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Prix invalide");
      return;
    }
    if (!adjustOpen.my_offer_id) {
      toast.error("Offre introuvable");
      return;
    }
    try {
      await adjust.mutateAsync({
        offerId: adjustOpen.my_offer_id,
        newPrice: price,
        alertId: adjustOpen.id,
      });
      toast.success(
        price <= adjustOpen.competitor_price
          ? "🏆 Prix ajusté ! Vous repassez devant le concurrent."
          : "Prix ajusté."
      );
      setAdjustOpen(null);
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || "ajustement échoué"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">Alertes Concurrents</h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">
            Soyez notifié dès qu'un vendeur passe devant vous sur un EAN que vous couvrez
          </p>
        </div>
      </div>

      {/* Banner critical */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA]">
          <AlertTriangle size={20} className="text-[#EF4444]" />
          <p className="text-[13px] font-medium text-[#991B1B]">
            ⚠️ {criticalCount} produit{criticalCount > 1 ? "s" : ""} où votre écart de prix dépasse 10 % — risque élevé de perte de vente.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <VCard className="text-center py-4">
          <p className="text-[12px] font-medium text-[#8B95A5]">Concurrents devant moi</p>
          <p className="text-[24px] font-bold mt-1 text-[#1D2530]">{alerts.length}</p>
        </VCard>
        <VCard className="text-center py-4">
          <p className="text-[12px] font-medium text-[#8B95A5]">Nouvelles alertes</p>
          <p className="text-[24px] font-bold mt-1 text-[#E70866]">{newCount}</p>
        </VCard>
        <VCard className="text-center py-4">
          <p className="text-[12px] font-medium text-[#8B95A5]">Écart {">"} 10 %</p>
          <p className="text-[24px] font-bold mt-1 text-[#EF4444]">{criticalCount}</p>
        </VCard>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input
            placeholder="Produit, EAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B95A5]" />
        </div>
      ) : filtered.length === 0 ? (
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle size={48} className="text-[#10B981] mb-4" />
            <h3 className="text-[15px] font-bold text-[#1D2530]">
              Vous êtes #1 sur tous vos EAN ! 🏆
            </h3>
            <p className="text-[13px] mt-1 text-[#8B95A5]">
              Aucun concurrent ne vous dépasse actuellement.
            </p>
          </div>
        </VCard>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Produit</th>
                  <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Mon rang</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Mon prix</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Concurrent</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Écart</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix suggéré</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Détecté</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const isNew = a.status === "new";
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors ${
                        isNew ? "bg-[#FFFBF5]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {isNew && (
                            <span className="w-2 h-2 rounded-full bg-[#E70866] shrink-0" title="Nouveau" />
                          )}
                          {a.product?.image_url && (
                            <img
                              src={a.product.image_url}
                              alt=""
                              className="w-9 h-9 rounded object-cover border border-[#E2E8F0]"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[220px] text-[#1D2530]">
                              {a.product?.name || "—"}
                            </p>
                            <p className="text-[11px] text-[#8B95A5]">
                              EAN {a.product?.gtin || "—"}
                              {a.product?.brand_name ? ` • ${a.product.brand_name}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-bold bg-[#FEF2F2] text-[#991B1B]">
                          {rankLabel(a.current_rank)} / {a.total_competitors + 1}
                        </span>
                        {a.previous_rank && a.previous_rank < a.current_rank && (
                          <p className="text-[10px] text-[#8B95A5] mt-1 flex items-center justify-center gap-0.5">
                            <ArrowDown size={10} /> depuis {rankLabel(a.previous_rank)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-[#1D2530]">
                        {Number(a.my_price).toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-mono font-semibold text-[#10B981]">
                          {Number(a.competitor_price).toFixed(2)} €
                        </p>
                        <p className="text-[11px] text-[#8B95A5] truncate max-w-[120px] ml-auto">
                          {a.competitor?.company_name || a.competitor?.name || "Concurrent MK"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold ${
                            a.gap_percentage >= 10 ? "text-[#EF4444]" : "text-[#F97316]"
                          }`}
                        >
                          <TrendingDown size={12} />
                          +{Number(a.gap_percentage).toFixed(1)} %
                        </span>
                        <p className="text-[11px] text-[#8B95A5]">
                          +{Number(a.gap_amount).toFixed(2)} €
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1B5BDA]">
                        {a.suggested_price ? `${Number(a.suggested_price).toFixed(2)} €` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#8B95A5] text-[12px]">
                        {formatDistanceToNow(new Date(a.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-[12px] bg-[#1B5BDA] hover:bg-[#1747AE]"
                            onClick={() => openAdjust(a)}
                            disabled={!a.my_offer_id}
                          >
                            <Target size={12} className="mr-1" /> Ajuster mon prix
                          </Button>
                          <button
                            className="text-[#8B95A5] hover:text-[#EF4444] transition-colors p-1"
                            title="Ignorer cette alerte"
                            onClick={() => dismiss.mutate(a.id)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap size={18} className="text-[#1B5BDA]" /> Ajuster mon prix
            </DialogTitle>
          </DialogHeader>
          {adjustOpen && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0]">
                {adjustOpen.product?.image_url && (
                  <img
                    src={adjustOpen.product.image_url}
                    alt=""
                    className="w-10 h-10 rounded object-cover border border-[#E2E8F0]"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate text-[#1D2530]">
                    {adjustOpen.product?.name}
                  </p>
                  <p className="text-[11px] text-[#8B95A5]">EAN {adjustOpen.product?.gtin}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-md bg-[#FEF2F2]">
                  <p className="text-[10px] font-medium text-[#991B1B]">Mon prix actuel</p>
                  <p className="text-[15px] font-bold text-[#EF4444] mt-0.5">
                    {Number(adjustOpen.my_price).toFixed(2)} €
                  </p>
                </div>
                <div className="p-3 rounded-md bg-[#F0FDF4]">
                  <p className="text-[10px] font-medium text-[#15803D]">Concurrent</p>
                  <p className="text-[15px] font-bold text-[#10B981] mt-0.5">
                    {Number(adjustOpen.competitor_price).toFixed(2)} €
                  </p>
                </div>
                <div className="p-3 rounded-md bg-[#EFF6FF]">
                  <p className="text-[10px] font-medium text-[#1E40AF]">Suggéré (-1 %)</p>
                  <p className="text-[15px] font-bold text-[#1B5BDA] mt-0.5">
                    {adjustOpen.suggested_price
                      ? `${Number(adjustOpen.suggested_price).toFixed(2)} €`
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#616B7C]">
                  Nouveau prix HTVA (€)
                </label>
                <Input
                  type="number"
                  step={0.01}
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
                {Number(newPrice) > 0 && Number(newPrice) <= adjustOpen.competitor_price && (
                  <p className="text-[11px] text-[#10B981] mt-1.5 flex items-center gap-1">
                    <CheckCircle size={11} /> Vous repasserez devant le concurrent
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>
              Annuler
            </Button>
            <Button
              onClick={confirmAdjust}
              disabled={adjust.isPending}
              className="bg-[#1B5BDA] hover:bg-[#1747AE]"
            >
              {adjust.isPending ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Zap size={14} className="mr-1" />
              )}
              Confirmer le nouveau prix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
