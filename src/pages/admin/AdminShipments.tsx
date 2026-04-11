import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Package, Search, Filter, AlertTriangle, CheckCircle2, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const AdminShipments = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["admin-all-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, vendors(company_name, name, shipping_mode)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const statuses = ["all", "draft", "ready_to_send", "shipped", "in_transit", "delivered", "exception", "cancelled"];
  const modes = ["all", "no_shipping", "own_sendcloud", "medikong_whitelabel"];

  const filtered = shipments.filter((s: any) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (modeFilter !== "all") {
      const vendorMode = (s.vendors as any)?.shipping_mode;
      if (vendorMode !== modeFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const vendorName = ((s.vendors as any)?.company_name || (s.vendors as any)?.name || "").toLowerCase();
      return (
        (s.tracking_number || "").toLowerCase().includes(q) ||
        (s.order_reference || "").toLowerCase().includes(q) ||
        vendorName.includes(q) ||
        (s.carrier || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalShipped = shipments.filter((s: any) => s.status === "shipped" || s.status === "in_transit").length;
  const totalDelivered = shipments.filter((s: any) => s.status === "delivered").length;
  const totalExceptions = shipments.filter((s: any) => s.status === "exception").length;

  const modeLabel: Record<string, string> = {
    no_shipping: "Manuel",
    own_sendcloud: "Sendcloud propre",
    medikong_whitelabel: "Whitelabel",
  };

  return (
    <div>
      <AdminTopBar title="Expéditions globales" subtitle="Vue cross-vendeur de toutes les expéditions" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Package} label="Total expéditions" value={String(shipments.length)} />
        <KpiCard icon={Truck} label="En transit" value={String(totalShipped)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={CheckCircle2} label="Livrées" value={String(totalDelivered)} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={AlertTriangle} label="Exceptions" value={String(totalExceptions)} iconColor="#EF4343" iconBg="#FEF2F2" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B95A5" }} />
          <Input
            placeholder="Recherche tracking, commande, vendeur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-[12px] h-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-md text-[12px] border"
          style={{ borderColor: "#E2E8F0", color: "#1D2530" }}
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s === "all" ? "Tous les statuts" : s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={modeFilter}
          onChange={e => setModeFilter(e.target.value)}
          className="h-9 px-3 rounded-md text-[12px] border"
          style={{ borderColor: "#E2E8F0", color: "#1D2530" }}
        >
          {modes.map(m => (
            <option key={m} value={m}>{m === "all" ? "Tous les modes" : modeLabel[m] || m}</option>
          ))}
        </select>
        {(search || statusFilter !== "all" || modeFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setModeFilter("all"); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded" style={{ color: "#EF4343" }}>
            <X size={12} /> Effacer
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune expédition trouvée</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Tracking", "Vendeur", "Mode", "Transporteur", "Statut", "Réf. commande", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((s: any) => {
                const vendor = s.vendors as any;
                const mode = vendor?.shipping_mode || "—";
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    style={{ borderBottom: "1px solid #F1F5F9" }}
                    onClick={() => navigate(`/admin/vendeurs/${s.vendor_id}`)}
                  >
                    <td className="px-4 py-3 text-[12px] font-mono font-medium" style={{ color: "#1B5BDA" }}>
                      {s.tracking_number || "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#1D2530" }}>
                      {vendor?.company_name || vendor?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        backgroundColor: mode === "medikong_whitelabel" ? "#EFF6FF" : mode === "own_sendcloud" ? "#F5F3FF" : "#F1F5F9",
                        color: mode === "medikong_whitelabel" ? "#1B5BDA" : mode === "own_sendcloud" ? "#7C3AED" : "#616B7C",
                      }}>
                        {modeLabel[mode] || mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{s.carrier || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#616B7C" }}>{s.order_reference || "—"}</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>
                      {new Date(s.created_at).toLocaleDateString("fr-BE")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 100 && (
        <p className="text-[11px] mt-2 text-center" style={{ color: "#8B95A5" }}>
          Affichage des 100 premiers résultats sur {filtered.length}
        </p>
      )}
    </div>
  );
};

export default AdminShipments;
