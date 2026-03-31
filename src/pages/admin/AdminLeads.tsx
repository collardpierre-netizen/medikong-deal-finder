import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Link, MousePointerClick, TrendingUp, Users, Download
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString();
}
function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d.toISOString();
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d.toISOString();
}

export default function AdminLeads() {
  const [tab, setTab] = useState("overview");

  // All leads with joins
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin-leads-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_leads")
        .select("*, external_vendors(name), products(name, gtin), external_offers(product_url)")
        .order("clicked_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // External vendors for summary
  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-ext-vendors-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("external_vendors").select("id, name").eq("is_active", true);
      return data || [];
    },
  });

  const leadsThisMonth = leads.filter(l => l.clicked_at && l.clicked_at >= startOfMonth());
  const leadsThisWeek = leads.filter(l => l.clicked_at && l.clicked_at >= startOfWeek());

  // Most clicked vendor
  const vendorCounts: Record<string, number> = {};
  leadsThisMonth.forEach(l => { vendorCounts[l.external_vendor_id] = (vendorCounts[l.external_vendor_id] || 0) + 1; });
  const topVendorId = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topVendorName = vendors.find(v => v.id === topVendorId)?.name || "—";

  // Most requested product
  const productCounts: Record<string, { count: number; name: string }> = {};
  leadsThisMonth.forEach(l => {
    const name = (l as any).products?.name || "?";
    if (!productCounts[l.product_id]) productCounts[l.product_id] = { count: 0, name };
    productCounts[l.product_id].count++;
  });
  const topProduct = Object.values(productCounts).sort((a, b) => b.count - a.count)[0]?.name || "—";

  // Chart: leads per day last 30 days
  const chartData: { day: string; count: number }[] = [];
  const since30 = daysAgo(30);
  const recentLeads = leads.filter(l => l.clicked_at && l.clicked_at >= since30);
  const dayMap: Record<string, number> = {};
  recentLeads.forEach(l => {
    const day = l.clicked_at!.slice(0, 10);
    dayMap[day] = (dayMap[day] || 0) + 1;
  });
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    chartData.push({ day: key.slice(5), count: dayMap[key] || 0 });
  }

  // Vendor summary
  const vendorSummary = vendors.map(v => {
    const vLeads = leads.filter(l => l.external_vendor_id === v.id);
    const lastAt = vLeads[0]?.clicked_at;
    return { ...v, leadCount: vLeads.length, lastAt };
  }).sort((a, b) => b.leadCount - a.leadCount);

  // Export CSV
  const exportCsv = () => {
    const header = "Date,Produit,GTIN,Vendeur,User ID\n";
    const rows = leads.map(l =>
      `${l.clicked_at?.slice(0,16)},${((l as any).products?.name || "").replace(/,/g," ")},${(l as any).products?.gtin || ""},${(l as any).external_vendors?.name || ""},${l.user_id || "Anonyme"}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads-export.csv"; a.click();
  };

  return (
    <div>
      <AdminTopBar title="Leads & Affiliation" subtitle="Suivi des clics vers les vendeurs externes" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={MousePointerClick} label="Leads ce mois" value={String(leadsThisMonth.length)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={TrendingUp} label="Leads cette semaine" value={String(leadsThisWeek.length)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Users} label="Vendeur le + cliqué" value={topVendorName} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Link} label="Produit le + demandé" value={topProduct.length > 30 ? topProduct.slice(0, 28) + "…" : topProduct} iconColor="#E70866" iconBg="#FFF1F3" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList style={{ backgroundColor: "#E2E8F0" }}>
            <TabsTrigger value="overview" className="text-[13px]">Graphique</TabsTrigger>
            <TabsTrigger value="leads" className="text-[13px]">Leads récents</TabsTrigger>
            <TabsTrigger value="vendors" className="text-[13px]">Par vendeur</TabsTrigger>
          </TabsList>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download size={14} className="mr-1" /> Export CSV</Button>
        </div>

        <TabsContent value="overview">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Leads par jour (30 derniers jours)</h3>
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: "#8B95A5" }}>
                <TrendingUp size={40} className="mb-3 opacity-30" />
                <p className="text-[14px] font-medium">Aucun lead enregistré</p>
                <p className="text-[12px] mt-1">Les données apparaîtront ici après les premiers clics.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8B95A5" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8B95A5" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Leads" fill="#1B5BDA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Date/Heure", "Produit", "GTIN", "Vendeur externe", "Utilisateur"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-[13px]" style={{ color: "#8B95A5" }}>Aucun lead</TableCell></TableRow>
                ) : leads.slice(0, 100).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{l.clicked_at ? new Date(l.clicked_at).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-[12px] font-medium max-w-[200px] truncate" style={{ color: "#1D2530" }}>{l.products?.name || "—"}</TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#616B7C" }}>{l.products?.gtin || "—"}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#1B5BDA" }}>{l.external_vendors?.name || "—"}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{l.user_id ? l.user_id.slice(0, 8) + "…" : "Anonyme"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="vendors">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Vendeur", "Nombre de leads", "Dernière activité"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorSummary.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{v.name}</TableCell>
                    <TableCell className="text-[13px] font-semibold" style={{ color: "#1B5BDA" }}>{v.leadCount}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>
                      {v.lastAt ? new Date(v.lastAt).toLocaleDateString("fr-BE") : "—"}
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
}
