import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Truck, Package, AlertTriangle, RotateCcw, CheckCircle2, Clock,
} from "lucide-react";

const alerts = [
  { type: "delay", message: "Commande MK-2026-04521 — retard 2j (Valerco → Pharmacie Delvaux)", severity: "high" },
  { type: "return", message: "Retour #RET-089 — Masques FFP2 lot défectueux (Brussels Med)", severity: "medium" },
  { type: "delay", message: "Commande MK-2026-04518 — retard 1j (Pharmamed → MRS Les Tilleuls)", severity: "medium" },
  { type: "stock", message: "Stock critique — Gants nitrile Aurelia (3 vendeurs < MOQ)", severity: "high" },
  { type: "return", message: "Retour #RET-088 — Tensoval Comfort défectueux (Hôpital Saint-Luc)", severity: "low" },
];

const shipments = [
  { id: "MK-2026-04525", buyer: "Pharmacie Centrale", seller: "Pharmamed SRL", items: 3, status: "transit", eta: "29/03", carrier: "PostNL" },
  { id: "MK-2026-04524", buyer: "MRS Beau Séjour", seller: "MedDistri SA", items: 5, status: "transit", eta: "28/03", carrier: "DHL" },
  { id: "MK-2026-04523", buyer: "Hôpital Erasme", seller: "Valerco NV", items: 12, status: "preparing", eta: "30/03", carrier: "Bpost" },
  { id: "MK-2026-04522", buyer: "Cabinet Dr. Dupont", seller: "Pharmamed SRL", items: 2, status: "delivered", eta: "27/03", carrier: "PostNL" },
  { id: "MK-2026-04521", buyer: "Pharmacie Delvaux", seller: "Valerco NV", items: 4, status: "delayed", eta: "26/03", carrier: "DHL" },
  { id: "MK-2026-04520", buyer: "Pharmacie du Parc", seller: "Brussels Med", items: 1, status: "delivered", eta: "26/03", carrier: "Bpost" },
];

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  transit: { label: "En transit", color: "#1B5BDA", bg: "#EFF6FF" },
  preparing: { label: "Préparation", color: "#F59E0B", bg: "#FFFBEB" },
  delivered: { label: "Livré", color: "#059669", bg: "#ECFDF5" },
  delayed: { label: "Retard", color: "#EF4343", bg: "#FEF2F2" },
};

const AdminLogistique = () => {
  return (
    <div>
      <AdminTopBar title="Logistique" subtitle="Suivi des expéditions et fulfillment" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Truck} label="En transit" value="47" evolution={{ value: 5, label: "aujourd'hui" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Package} label="Livrées (mars)" value="1 089" evolution={{ value: 8, label: "vs fév" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={AlertTriangle} label="Retards" value="3" iconColor="#EF4343" iconBg="#FEF2F2" />
        <KpiCard icon={RotateCcw} label="Retours" value="8" evolution={{ value: -2, label: "vs fév" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Fulfillment split */}
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#1D2530" }}>Mode fulfillment</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: "#616B7C" }}>Vendeur direct</span>
                <span className="font-bold" style={{ color: "#1B5BDA" }}>89%</span>
              </div>
              <Progress value={89} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: "#616B7C" }}>MediKong Fulfillment</span>
                <span className="font-bold" style={{ color: "#7C3AED" }}>11%</span>
              </div>
              <Progress value={11} className="h-2" />
            </div>
          </div>
        </div>

        {/* Carriers */}
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#1D2530" }}>Transporteurs</h3>
          <div className="space-y-2">
            {[
              { name: "Bpost", pct: 42 },
              { name: "PostNL", pct: 28 },
              { name: "DHL", pct: 22 },
              { name: "GLS", pct: 8 },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-[12px] w-14" style={{ color: "#616B7C" }}>{c.name}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: "#1B5BDA" }} />
                </div>
                <span className="text-[11px] font-bold w-8 text-right" style={{ color: "#1D2530" }}>{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery time */}
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#1D2530" }}>Délais moyens</h3>
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Belgique</span><span className="font-bold" style={{ color: "#059669" }}>1.8j</span></div>
            <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Pays-Bas</span><span className="font-bold" style={{ color: "#059669" }}>2.4j</span></div>
            <div className="flex justify-between"><span style={{ color: "#616B7C" }}>France</span><span className="font-bold" style={{ color: "#F59E0B" }}>3.1j</span></div>
            <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Allemagne</span><span className="font-bold" style={{ color: "#F59E0B" }}>3.5j</span></div>
          </div>
        </div>
      </div>

      {/* Shipments */}
      <div className="bg-white rounded-lg border p-5 mb-6" style={{ borderColor: "#E2E8F0" }}>
        <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Expéditions récentes</h3>
        <div className="space-y-2">
          {shipments.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
              <span className="text-[11px] font-mono font-bold" style={{ color: "#1B5BDA" }}>{s.id}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{s.buyer}</span>
                <span className="text-[11px] mx-2" style={{ color: "#8B95A5" }}>←</span>
                <span className="text-[11px]" style={{ color: "#616B7C" }}>{s.seller}</span>
              </div>
              <span className="text-[11px]" style={{ color: "#8B95A5" }}>{s.items} art.</span>
              <span className="text-[11px]" style={{ color: "#8B95A5" }}>{s.carrier}</span>
              <span className="text-[11px]" style={{ color: "#616B7C" }}>ETA {s.eta}</span>
              <Badge variant="outline" className="text-[10px]" style={{ color: statusMap[s.status].color, backgroundColor: statusMap[s.status].bg, borderColor: "transparent" }}>
                {statusMap[s.status].label}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
        <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Alertes logistiques</h3>
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: a.severity === "high" ? "#FEF2F2" : "#FFFBEB" }}>
              <AlertTriangle size={14} style={{ color: a.severity === "high" ? "#EF4343" : "#F59E0B" }} />
              <span className="text-[12px] flex-1" style={{ color: "#1D2530" }}>{a.message}</span>
              <Badge variant="outline" className="text-[10px]" style={{
                color: a.severity === "high" ? "#EF4343" : a.severity === "medium" ? "#F59E0B" : "#059669",
                borderColor: "transparent",
                backgroundColor: a.severity === "high" ? "#FEE2E2" : a.severity === "medium" ? "#FEF3C7" : "#ECFDF5",
              }}>
                {a.severity === "high" ? "Urgent" : a.severity === "medium" ? "Moyen" : "Faible"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminLogistique;
