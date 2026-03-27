import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Link, MousePointerClick, DollarSign, Users, TrendingUp,
  Rss, CheckCircle2, Clock, AlertCircle, ExternalLink,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const partners = [
  { name: "Medi-Market", integration: "API", model: "CPA", rate: "0.35 €", products: 4200, status: "active", revenue30d: 1470, clicks: 4200, conversions: 4200 * 0.032, convRate: 3.2 },
  { name: "Newpharma", integration: "XML + Scraping", model: "CPA", rate: "0.28 €", products: 3800, status: "active", revenue30d: 1064, clicks: 3800, conversions: 3800 * 0.028, convRate: 2.8 },
  { name: "Farmaline", integration: "XML Feed", model: "CPA", rate: "0.25 €", products: 3100, status: "active", revenue30d: 775, clicks: 3100, conversions: 3100 * 0.025, convRate: 2.5 },
  { name: "Pharmacie.be", integration: "Scraping", model: "CPC", rate: "0.12 €", products: 2400, status: "active", revenue30d: 288, clicks: 2400, conversions: 0, convRate: 0 },
  { name: "Viata.be", integration: "XML Feed", model: "CPA", rate: "0.30 €", products: 0, status: "pending", revenue30d: 0, clicks: 0, conversions: 0, convRate: 0 },
];

const revenueData = [
  { month: "Oct", cpa: 2800, cpc: 420 },
  { month: "Nov", cpa: 3100, cpc: 480 },
  { month: "Déc", cpa: 3400, cpc: 510 },
  { month: "Jan", cpa: 2900, cpc: 390 },
  { month: "Fév", cpa: 3200, cpc: 450 },
  { month: "Mar", cpa: 3597, cpc: 540 },
];

const feedsData = [
  { partner: "Medi-Market", type: "API Push", frequency: "Temps réel", lastSync: "27/03 14:30", products: 4200, status: "ok", errors: 0 },
  { partner: "Newpharma", type: "XML Pull", frequency: "6h", lastSync: "27/03 12:00", products: 3800, status: "ok", errors: 3 },
  { partner: "Farmaline", type: "XML Pull", frequency: "12h", lastSync: "27/03 06:00", products: 3100, status: "ok", errors: 0 },
  { partner: "Pharmacie.be", type: "Scraping", frequency: "24h", lastSync: "26/03 22:00", products: 2400, status: "warning", errors: 12 },
  { partner: "Viata.be", type: "XML Feed", frequency: "—", lastSync: "—", products: 0, status: "pending", errors: 0 },
];

const AdminLeads = () => {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <AdminTopBar title="Leads & Affiliation" subtitle="Monétisation offres indirectes" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={DollarSign} label="Revenu leads 30j" value="4 137 €" evolution={{ value: 18, label: "vs mois dernier" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={MousePointerClick} label="Clicks sortants" value="13 500" evolution={{ value: 12, label: "vs mois dernier" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={TrendingUp} label="Conversions" value="438" evolution={{ value: 8, label: "vs mois dernier" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Users} label="Partenaires actifs" value="4 / 5" iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Link} label="Rev. moy / click" value="0.31 €" evolution={{ value: 5, label: "vs mois dernier" }} iconColor="#E70866" iconBg="#FFF1F3" />
      </div>

      {/* 3 channels model */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Direct (Marketplace)", desc: "Commission ~15%, prix HT+TVA, buy box, paiement B2B", color: "#1B5BDA", bg: "#EFF6FF", pct: "72%" },
          { label: "Indirect (Affiliation)", desc: "CPA 0.22–0.35 € ou CPC 0.12 €, redirection partenaire", color: "#7C3AED", bg: "#F3F0FF", pct: "22%" },
          { label: "Marché (Intelligence)", desc: "Scraping prix informatifs, match confidence, pas de monétisation", color: "#616B7C", bg: "#F8FAFC", pct: "6%" },
        ].map((ch) => (
          <div key={ch.label} className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold" style={{ color: ch.color }}>{ch.label}</span>
              <span className="text-[18px] font-bold" style={{ color: ch.color }}>{ch.pct}</span>
            </div>
            <p className="text-[11px]" style={{ color: "#8B95A5" }}>{ch.desc}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="overview" className="text-[13px]">Overview</TabsTrigger>
          <TabsTrigger value="partenaires" className="text-[13px]">Partenaires</TabsTrigger>
          <TabsTrigger value="revenus" className="text-[13px]">Revenus</TabsTrigger>
          <TabsTrigger value="feeds" className="text-[13px]">Feeds</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Revenus affiliation (6 mois)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8B95A5" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8B95A5" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="cpa" name="CPA" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cpc" name="CPC" fill="#1B5BDA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="partenaires">
          <div className="grid grid-cols-2 gap-4">
            {partners.map((p) => (
              <div key={p.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[15px] font-semibold" style={{ color: "#1D2530" }}>{p.name}</span>
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: p.status === "active" ? "#059669" : "#F59E0B",
                    borderColor: p.status === "active" ? "#BBF7D0" : "#FDE68A",
                    backgroundColor: p.status === "active" ? "#ECFDF5" : "#FFFBEB",
                  }}>
                    {p.status === "active" ? "Actif" : "En attente"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                  <div><span style={{ color: "#8B95A5" }}>Intégration : </span><span style={{ color: "#1D2530" }}>{p.integration}</span></div>
                  <div><span style={{ color: "#8B95A5" }}>Modèle : </span><span style={{ color: "#7C3AED" }}>{p.model} {p.rate}</span></div>
                  <div><span style={{ color: "#8B95A5" }}>Produits : </span><span style={{ color: "#1D2530" }}>{p.products.toLocaleString("fr-BE")}</span></div>
                  <div><span style={{ color: "#8B95A5" }}>Rev. 30j : </span><span className="font-semibold" style={{ color: "#059669" }}>{p.revenue30d.toLocaleString("fr-BE")} €</span></div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="revenus">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Partenaire</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Modèle</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Taux</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Clicks</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Conversions</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Taux conv.</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Revenu 30j</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.filter(p => p.status === "active").map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{p.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]" style={{ color: "#7C3AED", borderColor: "#DDD6FE" }}>{p.model}</Badge></TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{p.rate}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{p.clicks.toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{Math.round(p.conversions)}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{p.convRate}%</TableCell>
                    <TableCell className="text-[12px] text-right font-semibold" style={{ color: "#059669" }}>{p.revenue30d.toLocaleString("fr-BE")} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="feeds">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Partenaire</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Type</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Fréquence</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Dernière sync</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Produits</TableHead>
                  <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Erreurs</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedsData.map((f) => (
                  <TableRow key={f.partner}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{f.partner}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{f.type}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{f.frequency}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{f.lastSync}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{f.products.toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: f.errors > 0 ? "#EF4343" : "#616B7C" }}>{f.errors}</TableCell>
                    <TableCell>
                      {f.status === "ok" ? <CheckCircle2 size={14} style={{ color: "#059669" }} /> :
                       f.status === "warning" ? <AlertCircle size={14} style={{ color: "#F59E0B" }} /> :
                       <Clock size={14} style={{ color: "#8B95A5" }} />}
                    </TableCell>
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

export default AdminLeads;
