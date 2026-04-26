import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface Props {
  vendorId: string;
  productId: string;
  countryCode?: string;
}

interface Point {
  snapshot_date: string;
  my_price: number | null;
  best_price: number | null;
  median_price: number | null;
  my_rank: number | null;
  total_offers: number | null;
}

export function AlertHistoryChart({ vendorId, productId, countryCode = "BE" }: Props) {
  const { data = [], isLoading } = useQuery<Point[]>({
    queryKey: ["alert-history-30d", vendorId, productId, countryCode],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_vendor_offer_history_30d", {
        _vendor_id: vendorId,
        _product_id: productId,
        _country_code: countryCode,
      });
      if (error) throw error;
      return (data || []) as Point[];
    },
    enabled: !!vendorId && !!productId,
  });

  if (isLoading) {
    return <div className="text-[12px] text-[#8B95A5] py-6 text-center">Chargement de l'historique…</div>;
  }

  if (!data.length) {
    return (
      <div className="rounded-md border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-4 text-center">
        <TrendingUp size={18} className="mx-auto text-[#8B95A5] mb-1" />
        <p className="text-[12px] text-[#616B7C]">
          Pas encore d'historique. Le premier point sera capturé cette nuit (03h00 UTC).
        </p>
      </div>
    );
  }

  const formatted = data.map((p) => ({
    ...p,
    label: new Date(p.snapshot_date).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" }),
    my_price: p.my_price != null ? Number(p.my_price) : null,
    best_price: p.best_price != null ? Number(p.best_price) : null,
    median_price: p.median_price != null ? Number(p.median_price) : null,
    my_rank: p.my_rank != null ? Number(p.my_rank) : null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[12px] font-semibold text-[#1D2530] mb-1">Évolution du prix (30 j)</h4>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formatted} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8B95A5" }} />
              <YAxis tick={{ fontSize: 10, fill: "#8B95A5" }} unit=" €" width={48} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                formatter={(v: any) => (v == null ? "—" : `${Number(v).toFixed(2)} €`)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="my_price" name="Mon prix" stroke="#3D9CFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="median_price" name="Médian" stroke="#8B95A5" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="best_price" name="Meilleur" stroke="#10B981" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-[12px] font-semibold text-[#1D2530] mb-1">Évolution du rang (30 j)</h4>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formatted} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8B95A5" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "#8B95A5" }}
                width={28}
                reversed
                allowDecimals={false}
                domain={[1, "dataMax"]}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                formatter={(v: any, name: string) =>
                  name === "Rang" ? (v == null ? "—" : `#${v}`) : v
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="stepAfter" dataKey="my_rank" name="Rang" stroke="#D97706" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
