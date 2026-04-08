import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Zap, Trash2, DollarSign, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SmartPricingWidgetProps {
  ean: string;
  cnk: string;
  priceHt: number;
  dlu: string;
  grade: string;
  quantity: number;
  onApplySuggestion?: (price: number) => void;
}

export function SmartPricingWidget({ ean, cnk, priceHt, dlu, grade, quantity, onApplySuggestion }: SmartPricingWidgetProps) {
  const { data: ref } = useQuery({
    queryKey: ["price-ref-lookup", ean, cnk],
    enabled: !!(ean || cnk),
    queryFn: async () => {
      let q = supabase.from("price_references").select("*").limit(1);
      if (ean) q = q.eq("ean", ean);
      else if (cnk) q = q.eq("cnk", cnk);
      const { data } = await q;
      return data?.[0] || null;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["restock-pricing-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_settings")
        .select("key, value")
        .in("key", ["destruction_cost_per_unit_eur", "pricing_zone_red_max", "pricing_zone_yellow_max", "pricing_zone_green_max", "pricing_widget_enabled"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  if (!ref || !settings || settings.pricing_widget_enabled === "false") return null;

  const pp = Number(ref.public_price_eur) || 0;
  const ppPharma = Number(ref.pharmacist_price_estimated_eur) || 0;
  const destructionCost = Number(settings.destruction_cost_per_unit_eur || 1.20);
  const redMax = Number(settings.pricing_zone_red_max || 20);
  const yellowMax = Number(settings.pricing_zone_yellow_max || 40);
  const greenMax = Number(settings.pricing_zone_green_max || 70);

  const decotePct = pp > 0 ? Math.round((1 - priceHt / pp) * 100) : 0;
  const gainVsDestruction = (priceHt * quantity) - (destructionCost * quantity);

  // Pricing zone
  let zone: { label: string; color: string; bg: string; emoji: string; desc: string };
  if (decotePct < redMax) {
    zone = { label: "Hors marché", color: "#E54545", bg: "#FEE2E2", emoji: "🔴", desc: "Risque invendu — prix trop élevé" };
  } else if (decotePct < yellowMax) {
    zone = { label: "Acceptable", color: "#F59E0B", bg: "#FEF3C7", emoji: "🟡", desc: "Correct, vente probable en quelques jours" };
  } else if (decotePct < greenMax) {
    zone = { label: "Sweet spot", color: "#00B85C", bg: "#EEFBF4", emoji: "🟢", desc: "Vente probable en <48h" };
  } else {
    zone = { label: "Bradé", color: "#8B929C", bg: "#F7F8FA", emoji: "⚪", desc: "Vente quasi-certaine" };
  }

  // Suggestion: middle of green zone
  const suggestedDecote = (yellowMax + greenMax) / 2 / 100;
  const suggestedPrice = Math.round(pp * (1 - suggestedDecote) * 100) / 100;

  // DLU-based recommendation
  const dluMonths = dlu ? Math.max(0, Math.round((new Date(dlu).getTime() - Date.now()) / (30.44 * 86400000))) : null;
  let dluRec = "";
  if (dluMonths !== null) {
    if (dluMonths > 6 && (grade === "A" || grade === "intact")) dluRec = "−30 à −40% recommandé";
    else if ((dluMonths >= 3 && dluMonths <= 6) || grade === "B" || grade === "damaged_packaging") dluRec = "−50 à −60% recommandé";
    else dluRec = "−70 à −85% recommandé";
  }

  return (
    <div className="bg-[#F0F4FF] border border-[#1C58D9]/20 rounded-lg p-3 space-y-2 text-xs">
      {/* Reference pills */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px] bg-white border-[#D0D5DC]">
          PP CBIP : {pp.toFixed(2)} €
        </Badge>
        <Badge variant="outline" className="text-[10px] bg-white border-[#D0D5DC]">
          Prix pharma. est. : {ppPharma.toFixed(2)} €
        </Badge>
        <Badge variant="outline" className="text-[10px] bg-white border-[#D0D5DC]">
          Source : {ref.source}
        </Badge>
      </div>

      {/* Pricing zone */}
      {priceHt > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm">{zone.emoji}</span>
          <Badge className="text-[10px] font-bold" style={{ backgroundColor: zone.bg, color: zone.color, border: "none" }}>
            {zone.label} (−{decotePct}% vs PP)
          </Badge>
          <span className="text-[#5C6470]">{zone.desc}</span>
        </div>
      )}

      {/* DLU recommendation */}
      {dluRec && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-[#5C6470] cursor-help">
                <Info size={12} />
                <span>Recommandation DLU : <b className="text-[#1E252F]">{dluRec}</b></span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Basé sur la DLU restante ({dluMonths} mois) et le grade. Les offres avec une forte décote se vendent plus vite.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Gain vs destruction */}
      {priceHt > 0 && quantity > 0 && (
        <div className="flex items-center gap-1.5">
          {gainVsDestruction >= 0 ? (
            <TrendingUp size={12} className="text-[#00B85C]" />
          ) : (
            <TrendingDown size={12} className="text-[#E54545]" />
          )}
          <span className="text-[#5C6470]">
            💰 Gain net vs destruction : <b className={gainVsDestruction >= 0 ? "text-[#00B85C]" : "text-[#E54545]"}>
              {gainVsDestruction >= 0 ? "+" : ""}{gainVsDestruction.toFixed(2)} €
            </b> sur ce lot
          </span>
        </div>
      )}

      {/* Apply suggestion */}
      {onApplySuggestion && suggestedPrice > 0 && suggestedPrice !== priceHt && (
        <Button
          size="sm"
          variant="outline"
          className="text-[10px] h-6 gap-1 text-[#1C58D9] border-[#1C58D9]/30 hover:bg-[#1C58D9]/5"
          onClick={() => onApplySuggestion(suggestedPrice)}
        >
          <Zap size={10} /> Appliquer le prix suggéré ({suggestedPrice.toFixed(2)} €)
        </Button>
      )}
    </div>
  );
}
