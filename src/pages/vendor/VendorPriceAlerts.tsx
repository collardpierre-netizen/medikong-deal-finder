import { useState } from "react";
import { useVendorPriceAlerts } from "@/hooks/usePriceAlerts";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle, Loader2, Search, TrendingDown, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const severityConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  info: { label: "Info", color: "#F59E0B", bg: "#FFFBEB", icon: "⚠️" },
  warning: { label: "Warning", color: "#F97316", bg: "#FFF7ED", icon: "🔶" },
  critical: { label: "Critique", color: "#EF4444", bg: "#FEF2F2", icon: "🔴" },
};

export default function VendorPriceAlerts() {
  const { vendorId } = useCurrentVendor();
  const { data: alertVendors = [], isLoading } = useVendorPriceAlerts(vendorId);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [alignDialog, setAlignDialog] = useState<any>(null);
  const [alignPrice, setAlignPrice] = useState("");
  const queryClient = useQueryClient();

  const filtered = alertVendors.filter((av: any) => {
    const alert = av.alert;
    if (!alert?.product) return false;
    const matchSearch = !search ||
      alert.product.name?.toLowerCase().includes(search.toLowerCase()) ||
      alert.product.gtin?.includes(search);
    const matchSev = severityFilter === "all" || alert.severity === severityFilter;
    return matchSearch && matchSev;
  });

  const criticalCount = alertVendors.filter((av: any) => av.alert?.severity === "critical").length;

  const handleQuickAlign = async () => {
    if (!alignDialog || !alignPrice) return;
    const newPrice = Number(alignPrice);
    if (isNaN(newPrice) || newPrice <= 0) { toast.error("Prix invalide"); return; }

    // Update the offer price
    const { error } = await supabase
      .from("offers")
      .update({
        price_excl_vat: newPrice,
        price_incl_vat: Math.round(newPrice * 1.21 * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("vendor_id", vendorId!)
      .eq("product_id", alignDialog.alert.product_id);

    if (error) { toast.error("Erreur lors de la mise à jour"); return; }

    // Log adjustment
    await supabase.from("price_adjustment_log").insert({
      vendor_id: vendorId!,
      product_id: alignDialog.alert.product_id,
      old_price: alignDialog.vendor_price,
      new_price: newPrice,
      trigger: "quick_align" as any,
      alert_id: alignDialog.alert_id,
    });

    // Mark as adjusted
    await supabase
      .from("price_alert_vendors")
      .update({
        price_adjusted: true,
        price_adjusted_at: new Date().toISOString(),
        old_price: alignDialog.vendor_price,
        new_price: newPrice,
      })
      .eq("id", alignDialog.id);

    toast.success("Prix ajusté avec succès !");
    setAlignDialog(null);
    queryClient.invalidateQueries({ queryKey: ["vendor-price-alerts"] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#1D2530" }}>Alertes Prix</h1>
        <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>
          Surveillance de vos prix par rapport au marché
        </p>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-[10px]" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertTriangle size={20} style={{ color: "#EF4444" }} />
          <p className="text-[13px] font-medium" style={{ color: "#991B1B" }}>
            ⚠️ {criticalCount} de vos produits sont significativement au-dessus du prix du marché. Ajustez vos prix pour rester compétitif.
          </p>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <VCard className="text-center py-4">
          <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Alertes actives</p>
          <p className="text-[20px] font-bold mt-1" style={{ color: "#1D2530" }}>{alertVendors.length}</p>
        </VCard>
        <VCard className="text-center py-4">
          <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Critiques</p>
          <p className="text-[20px] font-bold mt-1" style={{ color: "#EF4444" }}>{criticalCount}</p>
        </VCard>
        <VCard className="text-center py-4">
          <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Ajustées</p>
          <p className="text-[20px] font-bold mt-1" style={{ color: "#10B981" }}>
            {alertVendors.filter((av: any) => av.price_adjusted).length}
          </p>
        </VCard>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input
            placeholder="Rechercher produit, GTIN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36 h-9 text-[13px]"><SelectValue placeholder="Sévérité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#8B95A5]" />
        </div>
      ) : filtered.length === 0 ? (
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle size={48} className="text-[#10B981] mb-4" />
            <h3 className="text-[15px] font-bold" style={{ color: "#1D2530" }}>Tous vos prix sont compétitifs !</h3>
            <p className="text-[13px] mt-1" style={{ color: "#8B95A5" }}>
              Aucune alerte de prix pour le moment.
            </p>
          </div>
        </VCard>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0]" style={{ backgroundColor: "#F8FAFC" }}>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Produit</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Mon prix</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix marché</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Mon écart</th>
                  <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Sévérité</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix suggéré</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Depuis</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((av: any) => {
                  const alert = av.alert;
                  const product = alert?.product;
                  const sev = severityConfig[alert?.severity] || severityConfig.info;
                  return (
                    <tr key={av.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product?.image_url && (
                            <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover border border-[#E2E8F0]" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px]" style={{ color: "#1D2530" }}>
                              {product?.name || "—"}
                            </p>
                            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
                              {product?.gtin || ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: "#1D2530" }}>
                        {av.vendor_price?.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: "#10B981" }}>
                        {alert?.reference_price?.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-semibold" style={{ color: "#EF4444" }}>
                          +{av.vendor_gap_percentage?.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: sev.bg, color: sev.color }}
                        >
                          {sev.icon} {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "#2563EB" }}>
                        {av.suggested_price ? `${av.suggested_price.toFixed(2)} €` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#8B95A5]">
                        {formatDistanceToNow(new Date(alert?.created_at || av.created_at), { addSuffix: true, locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {av.price_adjusted ? (
                          <span className="text-[12px] font-semibold" style={{ color: "#10B981" }}>
                            ✓ Ajusté
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-[12px]"
                            onClick={() => {
                              setAlignDialog(av);
                              setAlignPrice(av.suggested_price?.toFixed(2) || "");
                            }}
                          >
                            <Zap size={12} className="mr-1" /> S'aligner
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Align dialog */}
      <Dialog open={!!alignDialog} onOpenChange={() => setAlignDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuster le prix</DialogTitle>
          </DialogHeader>
          {alignDialog && (
            <div className="space-y-4">
              <p className="text-[13px]" style={{ color: "#616B7C" }}>
                {alignDialog.alert?.product?.name}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Mon prix actuel</p>
                  <p className="text-[16px] font-bold" style={{ color: "#EF4444" }}>{alignDialog.vendor_price?.toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>Prix suggéré</p>
                  <p className="text-[16px] font-bold" style={{ color: "#10B981" }}>{alignDialog.suggested_price?.toFixed(2)} €</p>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium" style={{ color: "#616B7C" }}>Nouveau prix (€ HT)</label>
                <Input
                  type="number"
                  step={0.01}
                  value={alignPrice}
                  onChange={e => setAlignPrice(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlignDialog(null)}>Annuler</Button>
            <Button onClick={handleQuickAlign}>Confirmer l'ajustement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
