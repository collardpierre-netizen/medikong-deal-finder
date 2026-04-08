import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, Package, Users, MessageSquare, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface AggregatedOffer {
  ean: string;
  cnk: string | null;
  designation: string;
  seller_count: number;
  total_quantity: number;
  min_price: number;
  max_price: number;
  shortest_dlu: string;
  offer_ids: string[];
}

export default function RestockAdminOffers() {
  const [search, setSearch] = useState("");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["restock-admin-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_offers")
        .select("*")
        .eq("status", "published");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["restock-admin-stats"],
    queryFn: async () => {
      const { data: allOffers } = await supabase.from("restock_offers").select("id, status, seller_id");
      const { data: counterOffers } = await supabase.from("restock_counter_offers").select("id, status");
      const active = (allOffers || []).filter((o) => o.status === "published").length;
      const sold = (allOffers || []).filter((o) => o.status === "sold").length;
      const pending = (counterOffers || []).filter((c) => c.status === "pending").length;
      const sellers = new Set((allOffers || []).map((o) => o.seller_id)).size;
      return { active, sold, pending, sellers };
    },
  });

  const aggregated = useMemo<AggregatedOffer[]>(() => {
    const map = new Map<string, AggregatedOffer>();
    for (const o of offers) {
      const key = o.ean || o.cnk || o.id;
      if (!map.has(key)) {
        map.set(key, {
          ean: o.ean || "",
          cnk: o.cnk,
          designation: o.designation || "",
          seller_count: 0,
          total_quantity: 0,
          min_price: Infinity,
          max_price: -Infinity,
          shortest_dlu: o.dlu || "",
          offer_ids: [],
        });
      }
      const agg = map.get(key)!;
      agg.seller_count += 1;
      agg.total_quantity += o.quantity || 0;
      agg.min_price = Math.min(agg.min_price, o.price_ht || 0);
      agg.max_price = Math.max(agg.max_price, o.price_ht || 0);
      if (o.dlu && o.dlu < agg.shortest_dlu) agg.shortest_dlu = o.dlu;
      agg.offer_ids.push(o.id);
    }
    return Array.from(map.values());
  }, [offers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return aggregated;
    const q = search.toLowerCase();
    return aggregated.filter(
      (a) =>
        a.designation.toLowerCase().includes(q) ||
        a.ean.toLowerCase().includes(q) ||
        (a.cnk || "").toLowerCase().includes(q)
    );
  }, [aggregated, search]);

  const handleDiffuse = (item: AggregatedOffer) => {
    toast.success(`Opportunité "${item.designation}" diffusée aux acheteurs`);
  };

  const handleCampaign = () => {
    toast.success("Campagne email envoyée avec toutes les opportunités actives");
  };

  const kpis = [
    { label: "Offres actives", value: stats?.active ?? 0, icon: Package, color: "#1C58D9" },
    { label: "Ventes conclues", value: stats?.sold ?? 0, icon: CheckCircle, color: "#00B85C" },
    { label: "Contre-offres", value: stats?.pending ?? 0, icon: MessageSquare, color: "#F59E0B" },
    { label: "Vendeurs actifs", value: stats?.sellers ?? 0, icon: Users, color: "#8B5CF6" },
  ];

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E252F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Offres agrégées
        </h1>
        <Button onClick={handleCampaign} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2">
          <Send size={16} /> Envoyer campagne
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-[#D0D5DC] p-4 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: k.color + "15" }}>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1E252F]">{k.value}</p>
                <p className="text-xs text-[#5C6470]">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
        <Input
          placeholder="Rechercher par EAN, CNK ou nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-lg border-[#D0D5DC]"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D0D5DC] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-[#D0D5DC]">
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Produit</th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">EAN</th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">Vendeurs</th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">Qté totale</th>
                <th className="text-right px-4 py-3 font-medium text-[#5C6470]">Prix min</th>
                <th className="text-right px-4 py-3 font-medium text-[#5C6470]">Prix max</th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">DLU courte</th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#8B929C]">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#8B929C]">Aucune offre publiée</td></tr>
              ) : (
                filtered.map((item, i) => (
                  <tr key={i} className="border-b border-[#D0D5DC] last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-4 py-3 font-medium text-[#1E252F] max-w-[200px] truncate">{item.designation}</td>
                    <td className="px-4 py-3 text-[#5C6470] font-mono text-xs">{item.ean || item.cnk || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF0FB] text-[#1C58D9] text-xs font-medium">
                        {item.seller_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-[#1E252F]">{item.total_quantity}</td>
                    <td className="px-4 py-3 text-right text-[#1E252F]">{item.min_price === Infinity ? "—" : `${item.min_price.toFixed(2)} €`}</td>
                    <td className="px-4 py-3 text-right text-[#1E252F]">{item.max_price === -Infinity ? "—" : `${item.max_price.toFixed(2)} €`}</td>
                    <td className="px-4 py-3 text-center text-xs text-[#5C6470]">{formatDate(item.shortest_dlu)}</td>
                    <td className="px-4 py-3 text-center">
                      <Button size="sm" variant="outline" onClick={() => handleDiffuse(item)} className="text-xs gap-1 border-[#1C58D9] text-[#1C58D9] hover:bg-[#EBF0FB] rounded-lg">
                        <Send size={13} /> Diffuser
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
