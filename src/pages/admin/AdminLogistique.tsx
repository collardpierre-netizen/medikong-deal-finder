import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useOrders } from "@/hooks/useAdminData";
import { Truck, Package, AlertTriangle, RotateCcw, Database } from "lucide-react";

const AdminLogistique = () => {
  const { data: orders = [] } = useOrders();

  const shipped = orders.filter(o => ["shipped", "partially_shipped"].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === "delivered").length;
  const hasData = orders.length > 0;

  return (
    <div>
      <AdminTopBar title="Logistique" subtitle="Suivi des expéditions et fulfillment" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Truck} label="En transit" value={String(shipped)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Package} label="Livrées" value={String(delivered)} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={AlertTriangle} label="Retards" value="0" iconColor="#EF4343" iconBg="#FEF2F2" />
        <KpiCard icon={RotateCcw} label="Retours" value="0" iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Database size={56} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[16px] font-bold text-[#1D2530] mb-2">Aucune expédition</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-lg">
            Les expéditions, transporteurs et alertes logistiques s'afficheront ici dès que des commandes seront traitées.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Commandes récentes</h3>
          <div className="space-y-2">
            {orders.slice(0, 10).map(o => (
              <div key={o.id} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                <span className="text-[11px] font-mono font-bold" style={{ color: "#1B5BDA" }}>{o.order_number}</span>
                <span className="text-[12px] flex-1" style={{ color: "#1D2530" }}>{o.status}</span>
                <span className="text-[11px]" style={{ color: "#8B95A5" }}>
                  {new Date(o.created_at).toLocaleDateString("fr-BE")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogistique;
