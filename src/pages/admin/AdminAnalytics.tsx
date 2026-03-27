import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, Users, Search, TrendingUp, ShoppingCart, AlertTriangle,
  Eye, Target, Zap, ArrowDown, ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, FunnelChart } from "recharts";

const buyerProfiles = [
  { type: "Pharmacie", color: "#1B5BDA", bg: "#EFF6FF", ltv: "2 400 €/an", panier: "205 €", freq: "2x/mois", pct: 42 },
  { type: "MRS", color: "#7C3AED", bg: "#F3F0FF", ltv: "8 500 €/an", panier: "680 €", freq: "1x/mois", pct: 18 },
  { type: "Hôpital", color: "#EF4343", bg: "#FEF2F2", ltv: "45 000 €/an", panier: "3 200 €", freq: "2x/mois", pct: 8 },
  { type: "Infirmier(e)", color: "#059669", bg: "#ECFDF5", ltv: "480 €/an", panier: "89 €", freq: "4x/an", pct: 22 },
  { type: "Parapharmacie", color: "#F59E0B", bg: "#FFFBEB", ltv: "1 200 €/an", panier: "156 €", freq: "1x/mois", pct: 7 },
  { type: "Cabinet dentaire", color: "#E70866", bg: "#FFF1F3", ltv: "960 €/an", panier: "124 €", freq: "6x/an", pct: 3 },
];

const topSearches = [
  { query: "gants nitrile", searches: 1240, ctr: 34, conv: 8.2 },
  { query: "masques ffp2", searches: 980, ctr: 42, conv: 12.1 },
  { query: "désinfectant", searches: 870, ctr: 28, conv: 6.5 },
  { query: "compresses stériles", searches: 720, ctr: 38, conv: 9.8 },
  { query: "tensiomètre", searches: 650, ctr: 45, conv: 14.2 },
  { query: "sekusept", searches: 580, ctr: 52, conv: 18.5 },
  { query: "thermomètre infrarouge", searches: 490, ctr: 31, conv: 7.8 },
  { query: "hansaplast", searches: 420, ctr: 36, conv: 10.1 },
];

const zeroResults = [
  { query: "oxygène médical", searches: 45, lastSearch: "27/03" },
  { query: "défibrillateur AED", searches: 38, lastSearch: "27/03" },
  { query: "prothèse genou", searches: 28, lastSearch: "26/03" },
  { query: "scanner portable", searches: 22, lastSearch: "26/03" },
  { query: "appareil ECG", searches: 18, lastSearch: "25/03" },
];

const cohortesRFM = [
  { name: "Champions", pctCA: 38, count: 124, color: "#059669", action: "Programme VIP" },
  { name: "Fidèles", pctCA: 28, count: 210, color: "#1B5BDA", action: "Cross-sell" },
  { name: "Prometteurs", pctCA: 12, count: 185, color: "#7C3AED", action: "Nurturing" },
  { name: "À risque", pctCA: 14, count: 92, color: "#F59E0B", action: "Réactivation" },
  { name: "En sommeil", pctCA: 5, count: 156, color: "#EF4343", action: "Win-back" },
  { name: "Nouveaux", pctCA: 3, count: 78, color: "#8B95A5", action: "Onboarding" },
];

const signauxMarche = [
  { signal: "Rupture gants nitrile chez 2 concurrents", urgence: "high", impact: "Opportunité volume +30%" },
  { signal: "Hausse prix désinfectants +8% marché", urgence: "high", impact: "Ajustement tarifs recommandé" },
  { signal: "Nouveau concurrent DocMorris — offre agressive EPI", urgence: "high", impact: "Surveiller pricing EPI" },
  { signal: "Tendance hausse masques chirurgicaux", urgence: "medium", impact: "Augmenter stock" },
  { signal: "Baisse saisonnière solaires −40%", urgence: "low", impact: "Déstockage planifié" },
  { signal: "Certification CE expirée lot compresses", urgence: "high", impact: "Retrait immédiat requis" },
];

const funnelSteps = [
  { step: "Visiteurs", value: 45000, pct: 100, color: "#1B5BDA" },
  { step: "Recherche produit", value: 28500, pct: 63.3, color: "#3B82F6" },
  { step: "Fiche produit", value: 18200, pct: 40.4, color: "#7C3AED" },
  { step: "Ajout panier", value: 6800, pct: 15.1, color: "#F59E0B" },
  { step: "Checkout", value: 3200, pct: 7.1, color: "#E70866" },
  { step: "Commande confirmée", value: 2400, pct: 5.3, color: "#059669" },
];

const abandonReasons = [
  { reason: "Prix HT trop élevé vs concurrent", pct: 32 },
  { reason: "MOV non atteint", pct: 24 },
  { reason: "Délai livraison > 3 jours", pct: 18 },
  { reason: "Frais de port", pct: 14 },
  { reason: "Paiement — pas de Net 30/60", pct: 12 },
];

const AdminAnalytics = () => {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <AdminTopBar title="Analytics" subtitle="Intelligence commerciale et comportementale" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={Users} label="Acheteurs actifs" value="845" evolution={{ value: 12, label: "vs mois dernier" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Search} label="Recherches / jour" value="2 340" evolution={{ value: 8, label: "vs sem. dernière" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Target} label="Taux conversion" value="5.3%" evolution={{ value: 0.4, label: "vs mois dernier" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={ShoppingCart} label="Panier moyen" value="312 €" evolution={{ value: -2, label: "vs mois dernier" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={AlertTriangle} label="Zero-results" value="152" evolution={{ value: -8, label: "vs mois dernier" }} iconColor="#EF4343" iconBg="#FEF2F2" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="overview" className="text-[13px]">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="profils" className="text-[13px]">Profils acheteurs</TabsTrigger>
          <TabsTrigger value="recherches" className="text-[13px]">Recherches</TabsTrigger>
          <TabsTrigger value="cohortes" className="text-[13px]">Cohortes RFM</TabsTrigger>
          <TabsTrigger value="signaux" className="text-[13px]">Signaux marché</TabsTrigger>
          <TabsTrigger value="funnel" className="text-[13px]">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-4">
            {/* Buyer distribution */}
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Répartition acheteurs</h3>
              <div className="space-y-3">
                {buyerProfiles.map((b) => (
                  <div key={b.type} className="flex items-center gap-3">
                    <span className="text-[12px] w-28" style={{ color: "#616B7C" }}>{b.type}</span>
                    <Progress value={b.pct} className="flex-1 h-2" />
                    <span className="text-[11px] font-semibold w-8 text-right" style={{ color: b.color }}>{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alert signals */}
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Signaux d'alerte</h3>
              <div className="space-y-2">
                {signauxMarche.slice(0, 4).map((s, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: "#F8FAFC" }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{
                      backgroundColor: s.urgence === "high" ? "#EF4343" : s.urgence === "medium" ? "#F59E0B" : "#8B95A5"
                    }} />
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{s.signal}</p>
                      <p className="text-[11px]" style={{ color: "#8B95A5" }}>{s.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top searches */}
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Top recherches</h3>
              <div className="space-y-2">
                {topSearches.slice(0, 5).map((s, i) => (
                  <div key={s.query} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold w-5" style={{ color: "#8B95A5" }}>{i + 1}</span>
                    <span className="text-[12px] flex-1" style={{ color: "#1D2530" }}>{s.query}</span>
                    <span className="text-[11px]" style={{ color: "#8B95A5" }}>{s.searches}</span>
                    <span className="text-[11px] font-semibold" style={{ color: "#059669" }}>{s.conv}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero results */}
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Zero résultats</h3>
              <div className="space-y-2">
                {zeroResults.map((z) => (
                  <div key={z.query} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: "#FEF2F2" }}>
                    <span className="text-[12px]" style={{ color: "#1D2530" }}>{z.query}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]" style={{ color: "#EF4343" }}>{z.searches} recherches</span>
                      <span className="text-[10px]" style={{ color: "#8B95A5" }}>{z.lastSearch}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profils">
          <div className="grid grid-cols-3 gap-4">
            {buyerProfiles.map((b) => (
              <div key={b.type} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: b.bg }}>
                    <Users size={18} style={{ color: b.color }} />
                  </div>
                  <div>
                    <span className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>{b.type}</span>
                    <p className="text-[11px]" style={{ color: "#8B95A5" }}>{b.pct}% des acheteurs</p>
                  </div>
                </div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>LTV</span><span className="font-semibold" style={{ color: b.color }}>{b.ltv}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Panier moyen</span><span style={{ color: "#1D2530" }}>{b.panier}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Fréquence</span><span style={{ color: "#1D2530" }}>{b.freq}</span></div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recherches">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>#</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Recherche</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Volume</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>CTR</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSearches.map((s, i) => (
                  <TableRow key={s.query}>
                    <TableCell className="text-[12px] font-bold" style={{ color: "#8B95A5" }}>{i + 1}</TableCell>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{s.query}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{s.searches.toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{s.ctr}%</TableCell>
                    <TableCell className="text-[12px] text-right font-semibold" style={{ color: "#059669" }}>{s.conv}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-3" style={{ color: "#1D2530" }}>Recherches sans résultats</h3>
            <div className="space-y-2">
              {zeroResults.map((z) => (
                <div key={z.query} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: "#FEF2F2" }}>
                  <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{z.query}</span>
                  <span className="text-[11px]" style={{ color: "#EF4343" }}>{z.searches} recherches — {z.lastSearch}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cohortes">
          <div className="grid grid-cols-3 gap-4">
            {cohortesRFM.map((c) => (
              <div key={c.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[14px] font-semibold" style={{ color: c.color }}>{c.name}</span>
                  <Badge variant="outline" className="text-[10px]" style={{ color: c.color, borderColor: c.color + "40" }}>{c.count} acheteurs</Badge>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span style={{ color: "#8B95A5" }}>Part du CA</span>
                    <span className="font-semibold" style={{ color: c.color }}>{c.pctCA}%</span>
                  </div>
                  <Progress value={c.pctCA} className="h-2" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] p-2 rounded" style={{ backgroundColor: "#F8FAFC" }}>
                  <Zap size={12} style={{ color: c.color }} />
                  <span style={{ color: "#616B7C" }}>Action : </span>
                  <span className="font-medium" style={{ color: "#1D2530" }}>{c.action}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="signaux">
          <div className="space-y-3">
            {signauxMarche.map((s, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 flex items-start gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                  backgroundColor: s.urgence === "high" ? "#FEF2F2" : s.urgence === "medium" ? "#FFFBEB" : "#F8FAFC"
                }}>
                  <AlertTriangle size={16} style={{
                    color: s.urgence === "high" ? "#EF4343" : s.urgence === "medium" ? "#F59E0B" : "#8B95A5"
                  }} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{s.signal}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "#616B7C" }}>{s.impact}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0" style={{
                  color: s.urgence === "high" ? "#EF4343" : s.urgence === "medium" ? "#F59E0B" : "#8B95A5",
                  borderColor: s.urgence === "high" ? "#FECACA" : s.urgence === "medium" ? "#FDE68A" : "#E2E8F0",
                }}>
                  {s.urgence === "high" ? "Urgent" : s.urgence === "medium" ? "Moyen" : "Info"}
                </Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Entonnoir de conversion</h3>
              <div className="space-y-2">
                {funnelSteps.map((s, i) => (
                  <div key={s.step}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span style={{ color: "#1D2530" }}>{s.step}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#616B7C" }}>{s.value.toLocaleString("fr-BE")}</span>
                        <span className="font-semibold" style={{ color: s.color }}>{s.pct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-6 rounded" style={{ backgroundColor: "#F1F5F9" }}>
                      <div className="h-6 rounded flex items-center justify-center transition-all" style={{
                        width: `${s.pct}%`,
                        backgroundColor: s.color,
                        minWidth: s.pct > 10 ? undefined : "40px",
                      }}>
                        {s.pct > 10 && <span className="text-white text-[10px] font-semibold">{s.pct}%</span>}
                      </div>
                    </div>
                    {i < funnelSteps.length - 1 && (
                      <div className="flex justify-center my-1">
                        <ArrowDown size={14} style={{ color: "#8B95A5" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <h3 className="text-[14px] font-semibold mb-3" style={{ color: "#1D2530" }}>Raisons d'abandon</h3>
                <div className="space-y-3">
                  {abandonReasons.map((r) => (
                    <div key={r.reason}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span style={{ color: "#1D2530" }}>{r.reason}</span>
                        <span className="font-semibold" style={{ color: "#EF4343" }}>{r.pct}%</span>
                      </div>
                      <Progress value={r.pct} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <h3 className="text-[14px] font-semibold mb-3" style={{ color: "#1D2530" }}>Conversion par device</h3>
                <div className="space-y-2 text-[12px]">
                  {[
                    { device: "Desktop", conv: 6.8, sessions: "62%" },
                    { device: "Tablet", conv: 4.2, sessions: "24%" },
                    { device: "Mobile", conv: 2.1, sessions: "14%" },
                  ].map((d) => (
                    <div key={d.device} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: "#F8FAFC" }}>
                      <span style={{ color: "#1D2530" }}>{d.device}</span>
                      <div className="flex items-center gap-3">
                        <span style={{ color: "#8B95A5" }}>{d.sessions} sessions</span>
                        <span className="font-semibold" style={{ color: "#059669" }}>{d.conv}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAnalytics;
