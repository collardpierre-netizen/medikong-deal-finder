import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Eye, Globe, RefreshCw, AlertTriangle, CheckCircle2, Clock,
  TrendingDown, TrendingUp, Activity, Wifi, WifiOff,
} from "lucide-react";

const sources = [
  { name: "Medi-Market", method: "Scraping", type: "Indirect", status: "online", products: 4200, lastScan: "27/03 14:32", frequency: "4h", confidence: 94 },
  { name: "Newpharma", method: "API", type: "Indirect", status: "online", products: 3800, lastScan: "27/03 14:28", frequency: "2h", confidence: 97 },
  { name: "Farmaline", method: "XML Feed", type: "Indirect", status: "online", products: 3100, lastScan: "27/03 13:45", frequency: "6h", confidence: 91 },
  { name: "Pharmacie.be", method: "Scraping", type: "Marché", status: "online", products: 2400, lastScan: "27/03 12:10", frequency: "12h", confidence: 82 },
  { name: "Multipharma", method: "Scraping", type: "Indirect", status: "warning", products: 1900, lastScan: "27/03 08:00", frequency: "12h", confidence: 76 },
  { name: "DocMorris BE", method: "API", type: "Indirect", status: "online", products: 2800, lastScan: "27/03 14:15", frequency: "3h", confidence: 95 },
  { name: "Amazon.de (BE)", method: "Scraping", type: "Marché", status: "online", products: 5200, lastScan: "27/03 13:00", frequency: "6h", confidence: 78 },
  { name: "Pharma360", method: "XML Feed", type: "Indirect", status: "offline", products: 1600, lastScan: "26/03 22:00", frequency: "24h", confidence: 68 },
];

const comparativeData = [
  { product: "Gants nitrile Aurelia x200", cnk: "CNK-12450", mediMarket: 13.90, newpharma: 14.20, farmaline: 13.50, pharmacieBe: 14.80, bestMK: 12.90, ecart: -4.4 },
  { product: "Sekusept Aktiv 6kg", cnk: "CNK-10480", mediMarket: 35.90, newpharma: 34.50, farmaline: 36.20, pharmacieBe: 37.00, bestMK: 33.59, ecart: -2.6 },
  { product: "Masques FFP2 Kolmi x50", cnk: "CNK-15230", mediMarket: 19.90, newpharma: 18.90, farmaline: 20.50, pharmacieBe: 21.00, bestMK: 18.50, ecart: -2.1 },
  { product: "Tensoval Comfort", cnk: "CNK-28104", mediMarket: 54.90, newpharma: 52.00, farmaline: 55.50, pharmacieBe: null, bestMK: 49.90, ecart: -4.0 },
  { product: "Compresses stériles 10x10 x100", cnk: "CNK-08372", mediMarket: 8.50, newpharma: 8.20, farmaline: 8.90, pharmacieBe: 9.10, bestMK: 7.90, ecart: -3.7 },
  { product: "Omron M3 Comfort", cnk: "CNK-31205", mediMarket: 62.50, newpharma: 59.90, farmaline: 64.00, pharmacieBe: 65.50, bestMK: 58.50, ecart: -2.3 },
  { product: "Hansaplast Sensitive x40", cnk: "CNK-04521", mediMarket: 4.90, newpharma: 4.50, farmaline: 5.20, pharmacieBe: 5.00, bestMK: 4.20, ecart: -6.7 },
  { product: "Mepilex Border 10x10 x5", cnk: "CNK-19834", mediMarket: 28.90, newpharma: 27.50, farmaline: 29.50, pharmacieBe: null, bestMK: 26.90, ecart: -2.2 },
];

const fmt = (n: number | null) => n != null ? n.toFixed(2) + " €" : "—";

const AdminVeillePrix = () => {
  const [tab, setTab] = useState("sources");

  return (
    <div>
      <AdminTopBar title="Veille prix" subtitle="Surveillance concurrentielle 8 sources" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Globe} label="Sources actives" value="7 / 8" evolution={{ value: 0, label: "stable" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Eye} label="Produits surveillés" value="24 900" evolution={{ value: 12, label: "vs mois dernier" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={RefreshCw} label="Scans / jour" value="186" evolution={{ value: 8, label: "vs sem. dernière" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={AlertTriangle} label="Alertes prix" value="34" evolution={{ value: -15, label: "vs hier" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="sources" className="text-[13px]">Sources</TabsTrigger>
          <TabsTrigger value="comparatif" className="text-[13px]">Comparatif</TabsTrigger>
          <TabsTrigger value="alertes" className="text-[13px]">Alertes</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <div className="grid grid-cols-2 gap-4">
            {sources.map((s) => (
              <div key={s.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {s.status === "online" ? <Wifi size={14} style={{ color: "#059669" }} /> : s.status === "warning" ? <Activity size={14} style={{ color: "#F59E0B" }} /> : <WifiOff size={14} style={{ color: "#EF4343" }} />}
                    <span className="font-semibold text-[14px]" style={{ color: "#1D2530" }}>{s.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-medium" style={{
                    color: s.type === "Indirect" ? "#7C3AED" : "#616B7C",
                    borderColor: s.type === "Indirect" ? "#DDD6FE" : "#E2E8F0",
                    backgroundColor: s.type === "Indirect" ? "#F3F0FF" : "#F8FAFC",
                  }}>
                    {s.type}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-[12px] mb-3">
                  <div><span style={{ color: "#8B95A5" }}>Méthode : </span><span style={{ color: "#1D2530" }}>{s.method}</span></div>
                  <div><span style={{ color: "#8B95A5" }}>Produits : </span><span style={{ color: "#1D2530" }}>{s.products.toLocaleString("fr-BE")}</span></div>
                  <div><span style={{ color: "#8B95A5" }}>Dernier scan : </span><span style={{ color: "#1D2530" }}>{s.lastScan}</span></div>
                  <div><span style={{ color: "#8B95A5" }}>Fréquence : </span><span style={{ color: "#1D2530" }}>{s.frequency}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>Matching</span>
                  <Progress value={s.confidence} className="flex-1 h-2" />
                  <span className="text-[11px] font-semibold" style={{ color: s.confidence >= 90 ? "#059669" : s.confidence >= 80 ? "#F59E0B" : "#EF4343" }}>{s.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comparatif">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Produit</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>CNK</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Medi-Market</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Newpharma</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Farmaline</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Pharmacie.be</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#1B5BDA" }}>Meilleur MK</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Écart</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparativeData.map((row) => (
                  <TableRow key={row.cnk}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{row.product}</TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{row.cnk}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{fmt(row.mediMarket)}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{fmt(row.newpharma)}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{fmt(row.farmaline)}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{fmt(row.pharmacieBe)}</TableCell>
                    <TableCell className="text-[12px] text-right font-semibold" style={{ color: "#1B5BDA" }}>{fmt(row.bestMK)}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: row.ecart < 0 ? "#059669" : "#EF4343" }}>
                        {row.ecart < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {row.ecart > 0 ? "+" : ""}{row.ecart}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="alertes">
          <div className="space-y-3">
            {[
              { product: "Gants nitrile Aurelia x200", source: "Newpharma", type: "Baisse concurrent", detail: "14.20 € → 12.50 € (-12%)", severity: "high" },
              { product: "Omron M3 Comfort", source: "Medi-Market", type: "Prix inférieur", detail: "MK 58.50 € vs concurrent 55.90 € (+4.7%)", severity: "high" },
              { product: "Sekusept Aktiv 6kg", source: "Farmaline", type: "Rupture concurrent", detail: "Stock épuisé — opportunité", severity: "medium" },
              { product: "Hansaplast Sensitive x40", source: "Amazon.de", type: "Nouveau prix", detail: "3.90 € (−15% vs MK)", severity: "high" },
              { product: "Compresses stériles 10x10", source: "DocMorris", type: "Promo détectée", detail: "−20% affiché, prix temporaire 6.56 €", severity: "medium" },
              { product: "Mepilex Border 10x10", source: "Pharmacie.be", type: "Match incertain", detail: "Confidence 62% — vérification manuelle requise", severity: "low" },
            ].map((a, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{
                  backgroundColor: a.severity === "high" ? "#EF4343" : a.severity === "medium" ? "#F59E0B" : "#8B95A5"
                }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{a.product}</span>
                    <Badge variant="outline" className="text-[10px]">{a.source}</Badge>
                  </div>
                  <p className="text-[12px]" style={{ color: "#616B7C" }}>{a.type} — {a.detail}</p>
                </div>
                <Clock size={14} style={{ color: "#8B95A5" }} />
                <span className="text-[11px]" style={{ color: "#8B95A5" }}>il y a 2h</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminVeillePrix;
