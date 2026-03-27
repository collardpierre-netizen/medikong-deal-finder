import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Users, Mail, Eye, MousePointerClick, Send, Clock, CheckCircle2,
} from "lucide-react";

const segments = [
  { name: "Pharmacies Bruxelles", count: 124, color: "#1B5BDA", bg: "#EFF6FF" },
  { name: "Gros acheteurs >5k€/mois", count: 38, color: "#059669", bg: "#ECFDF5" },
  { name: "Inactifs 30j+", count: 67, color: "#EF4343", bg: "#FEF2F2" },
  { name: "Nouveaux 7j", count: 15, color: "#F59E0B", bg: "#FFFBEB" },
  { name: "Vendeurs premium", count: 12, color: "#7C3AED", bg: "#F3F0FF" },
];

const campaigns = [
  { name: "Promo printemps — Gants & EPI", date: "25/03/2026", sent: 842, opened: 312, clicked: 89, status: "sent" },
  { name: "Nouveautés Hartmann", date: "20/03/2026", sent: 1240, opened: 498, clicked: 112, status: "sent" },
  { name: "Relance inactifs mars", date: "18/03/2026", sent: 67, opened: 18, clicked: 4, status: "sent" },
  { name: "Newsletter Q1 2026", date: "01/03/2026", sent: 2480, opened: 820, clicked: 198, status: "sent" },
  { name: "Offre flash TENA -15%", date: "Brouillon", sent: 0, opened: 0, clicked: 0, status: "draft" },
];

const messages = [
  { from: "Pharmacie Delvaux", subject: "Demande devis gants nitrile x2000", time: "14:32", read: false },
  { from: "MRS Les Tilleuls", subject: "Problème livraison commande MK-2026-04521", time: "13:15", read: false },
  { from: "Dr. Van Damme", subject: "Catalogue produits respiratoire", time: "11:45", read: true },
  { from: "Pharmamed SRL", subject: "MAJ tarifs avril 2026", time: "10:20", read: true },
  { from: "Hôpital Saint-Luc", subject: "Appel d'offres matériel chirurgical", time: "09:00", read: true },
  { from: "Brussels Med SPRL", subject: "Renouvellement contrat annuel", time: "Hier 17:30", read: true },
];

const AdminCRM = () => {
  const [tab, setTab] = useState("segments");

  return (
    <div>
      <AdminTopBar title="CRM" subtitle="Gestion de la relation client & campagnes" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users} label="Contacts" value="1 247" evolution={{ value: 5, label: "ce mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Mail} label="Emails mars" value="4 832" evolution={{ value: 12, label: "vs fév" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Eye} label="Taux ouverture" value="34.2%" evolution={{ value: 2.1, label: "vs fév" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={MousePointerClick} label="Taux clic" value="8.7%" evolution={{ value: 0.8, label: "vs fév" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="segments" className="text-[13px]">Segments</TabsTrigger>
          <TabsTrigger value="campagnes" className="text-[13px]">Campagnes</TabsTrigger>
          <TabsTrigger value="messages" className="text-[13px]">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="segments">
          <div className="grid grid-cols-3 gap-4">
            {segments.map((s) => (
              <div key={s.name} className="bg-white rounded-lg border p-5 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                  <Users size={20} style={{ color: s.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{s.name}</p>
                  <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.count}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="campagnes">
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.name} className="bg-white rounded-lg border p-4 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.status === "sent" ? "#ECFDF5" : "#FFFBEB" }}>
                  {c.status === "sent" ? <Send size={16} style={{ color: "#059669" }} /> : <Clock size={16} style={{ color: "#F59E0B" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.name}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>{c.date}</p>
                </div>
                {c.status === "sent" && (
                  <div className="flex gap-4 text-[11px]" style={{ color: "#616B7C" }}>
                    <span>Envoyés: <b>{c.sent}</b></span>
                    <span>Ouverts: <b>{c.opened}</b></span>
                    <span>Clics: <b>{c.clicked}</b></span>
                  </div>
                )}
                <Badge variant="outline" className="text-[10px]" style={{
                  color: c.status === "sent" ? "#059669" : "#F59E0B",
                  borderColor: c.status === "sent" ? "#BBF7D0" : "#FDE68A",
                  backgroundColor: c.status === "sent" ? "#ECFDF5" : "#FFFBEB",
                }}>
                  {c.status === "sent" ? "Envoyé" : "Brouillon"}
                </Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="messages">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            {messages.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-b last:border-b-0" style={{ borderColor: "#F1F5F9", backgroundColor: !m.read ? "#FAFBFF" : "transparent" }}>
                {!m.read && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#1B5BDA" }} />}
                {m.read && <div className="w-2 h-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] ${!m.read ? "font-bold" : "font-medium"}`} style={{ color: "#1D2530" }}>{m.from}</span>
                  </div>
                  <p className="text-[12px] truncate" style={{ color: "#616B7C" }}>{m.subject}</p>
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "#8B95A5" }}>{m.time}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCRM;
