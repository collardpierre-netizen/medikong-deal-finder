import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLeadsPartners, useOffersIndirect } from "@/hooks/useAdminData";
import {
  Link, MousePointerClick, DollarSign, Users, TrendingUp,
  CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const revenueData: { month: string; cpa: number; cpc: number }[] = [];

const AdminLeads = () => {
  const [tab, setTab] = useState("overview");
  const { data: partners = [], isLoading } = useLeadsPartners();

  const activePartners = partners.filter(p => p.status === "active");
  const totalRevenue = activePartners.reduce((a, p) => a + Number(p.revenue_30d || 0), 0);
  const totalClicks = activePartners.reduce((a, p) => a + (p.clicks_30d || 0), 0);
  const totalConversions = activePartners.reduce((a, p) => a + (p.conversions_30d || 0), 0);

  return (
    <div>
      <AdminTopBar title="Leads & Affiliation" subtitle="Monétisation offres indirectes" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={DollarSign} label="Revenu leads 30j" value={`${totalRevenue.toLocaleString("fr-BE")} €`} evolution={{ value: 18, label: "vs mois dernier" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={MousePointerClick} label="Clicks sortants" value={totalClicks.toLocaleString("fr-BE")} evolution={{ value: 12, label: "vs mois dernier" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={TrendingUp} label="Conversions" value={String(totalConversions)} evolution={{ value: 8, label: "vs mois dernier" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Users} label="Partenaires actifs" value={`${activePartners.length} / ${partners.length}`} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Link} label="Rev. moy / click" value={totalClicks > 0 ? `${(totalRevenue / totalClicks).toFixed(2)} €` : "0 €"} iconColor="#E70866" iconBg="#FFF1F3" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="overview" className="text-[13px]">Overview</TabsTrigger>
          <TabsTrigger value="partenaires" className="text-[13px]">Partenaires</TabsTrigger>
          <TabsTrigger value="revenus" className="text-[13px]">Revenus</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Revenus affiliation (6 mois)</h3>
            {revenueData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: "#8B95A5" }}>
                <TrendingUp size={40} className="mb-3 opacity-30" />
                <p className="text-[14px] font-medium">Aucune donnée de revenus</p>
                <p className="text-[12px] mt-1">Les données apparaîtront ici une fois les premiers partenaires actifs.</p>
              </div>
            ) : (
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
            )}
          </div>
        </TabsContent>

        <TabsContent value="partenaires">
          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <div className="grid grid-cols-2 gap-4">
              {partners.map((p) => (
                <div key={p.id} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
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
                    <div><span style={{ color: "#8B95A5" }}>Type : </span><span style={{ color: "#1D2530" }}>{p.type || "indirect"}</span></div>
                    <div><span style={{ color: "#8B95A5" }}>Modèle : </span><span style={{ color: "#7C3AED" }}>{p.model} {Number(p.cpa_cpc_amount || 0).toFixed(2)} €</span></div>
                    <div><span style={{ color: "#8B95A5" }}>Produits : </span><span style={{ color: "#1D2530" }}>{(p.products_count || 0).toLocaleString("fr-BE")}</span></div>
                    <div><span style={{ color: "#8B95A5" }}>Rev. 30j : </span><span className="font-semibold" style={{ color: "#059669" }}>{Number(p.revenue_30d || 0).toLocaleString("fr-BE")} €</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="revenus">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Partenaire", "Modèle", "Clicks", "Conversions", "Revenu 30j"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePartners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{p.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]" style={{ color: "#7C3AED", borderColor: "#DDD6FE" }}>{p.model}</Badge></TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{(p.clicks_30d || 0).toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-[12px] text-right" style={{ color: "#616B7C" }}>{p.conversions_30d || 0}</TableCell>
                    <TableCell className="text-[12px] text-right font-semibold" style={{ color: "#059669" }}>{Number(p.revenue_30d || 0).toLocaleString("fr-BE")} €</TableCell>
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
