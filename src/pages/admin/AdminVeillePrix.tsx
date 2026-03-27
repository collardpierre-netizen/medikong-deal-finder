import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useOffersMarket } from "@/hooks/useAdminData";
import {
  Eye, Globe, RefreshCw, AlertTriangle, Wifi, WifiOff, Activity,
  TrendingDown, TrendingUp,
} from "lucide-react";

const AdminVeillePrix = () => {
  const [tab, setTab] = useState("sources");
  const { data: offersMarket = [], isLoading } = useOffersMarket();

  // Group by source_name
  const sourceMap = new Map<string, { count: number; method: string; lastScan: string }>();
  offersMarket.forEach(o => {
    const existing = sourceMap.get(o.source_name);
    if (!existing) {
      sourceMap.set(o.source_name, { count: 1, method: o.method || "scraping", lastScan: o.created_at });
    } else {
      existing.count++;
      if (o.created_at > existing.lastScan) existing.lastScan = o.created_at;
    }
  });

  const sources = Array.from(sourceMap.entries()).map(([name, data]) => ({
    name,
    method: data.method === "api" ? "API" : data.method === "feed" ? "XML Feed" : "Scraping",
    products: data.count,
    lastScan: new Date(data.lastScan).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    status: "online" as const,
    confidence: data.method === "api" ? 97 : data.method === "feed" ? 91 : 85,
  }));

  // Build comparative from offers_market data
  const productPrices = new Map<string, { product: string; cnk: string; prices: Record<string, number | null>; bestMK: number }>();
  offersMarket.forEach(o => {
    const pid = o.product_id;
    const pName = (o.products as any)?.product_name || pid;
    const cnk = (o.products as any)?.cnk || "—";
    if (!productPrices.has(pid)) {
      productPrices.set(pid, { product: pName, cnk, prices: {}, bestMK: 0 });
    }
    const entry = productPrices.get(pid)!;
    entry.prices[o.source_name] = Number(o.price) || null;
  });

  const comparativeData = Array.from(productPrices.values()).slice(0, 8);

  return (
    <div>
      <AdminTopBar title="Veille prix" subtitle="Surveillance concurrentielle" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Globe} label="Sources actives" value={`${sources.length}`} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Eye} label="Prix surveillés" value={String(offersMarket.length)} evolution={{ value: 12, label: "vs mois dernier" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={RefreshCw} label="Produits couverts" value={String(productPrices.size)} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={AlertTriangle} label="Sources" value={String(sources.length)} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="sources" className="text-[13px]">Sources</TabsTrigger>
          <TabsTrigger value="comparatif" className="text-[13px]">Comparatif</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <div className="grid grid-cols-2 gap-4">
              {sources.map((s) => (
                <div key={s.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wifi size={14} style={{ color: "#059669" }} />
                      <span className="font-semibold text-[14px]" style={{ color: "#1D2530" }}>{s.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{s.method}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-[12px] mb-3">
                    <div><span style={{ color: "#8B95A5" }}>Produits : </span><span style={{ color: "#1D2530" }}>{s.products}</span></div>
                    <div><span style={{ color: "#8B95A5" }}>Dernier scan : </span><span style={{ color: "#1D2530" }}>{s.lastScan}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: "#8B95A5" }}>Matching</span>
                    <Progress value={s.confidence} className="flex-1 h-2" />
                    <span className="text-[11px] font-semibold" style={{ color: s.confidence >= 90 ? "#059669" : "#F59E0B" }}>{s.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparatif">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Produit</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>CNK</TableHead>
                  {sources.map(s => (
                    <TableHead key={s.name} className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>{s.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparativeData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{row.product}</TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{row.cnk}</TableCell>
                    {sources.map(s => (
                      <TableCell key={s.name} className="text-[12px] text-right" style={{ color: "#616B7C" }}>
                        {row.prices[s.name] != null ? `${Number(row.prices[s.name]).toFixed(2)} €` : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminVeillePrix;
