import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useOrders } from "@/hooks/useAdminData";
import { Truck, Package, AlertTriangle, RotateCcw, Database, CalendarClock } from "lucide-react";
import { fmtEur } from "@/lib/format-currency";

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
            {orders.slice(0, 10).map((o: any) => {
              const draftLines = Array.isArray(o.draft_payload?.lines) ? o.draft_payload.lines : [];
              const persistedLines = (o.order_lines || []) as any[];
              const lines = persistedLines.length > 0 ? persistedLines : draftLines;
              // Vendeurs (dédupliqués)
              const seen = new Set<string>();
              const names: string[] = [];
              for (const l of lines) {
                const key = l.vendor_id || l.vendors?.slug || l.vendors?.company_name;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                const name = l.vendors?.company_name?.trim();
                if (name) names.push(name);
              }
              let seller = "—";
              if (names.length === 1) seller = names[0];
              else if (names.length > 1) seller = `${names[0]} +${names.length - 1}`;
              else if (seen.size > 0) seller = `${seen.size} vendeur${seen.size > 1 ? "s" : ""}`;
              // Montant TTC (fallback depuis les lignes si total non figé)
              let amountNum = Number(o.total_incl_vat || 0);
              if (!amountNum && lines.length > 0) {
                amountNum = lines.reduce((sum: number, l: any) =>
                  sum + Number(l.line_total_incl_vat ?? (Number(l.unit_price_incl_vat || l.unit_price_excl_vat || 0) * Number(l.quantity || 0) * (1 + Number(l.vat_rate || 0) / 100))),
                0);
              }
              return (
                <div key={o.id} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <span className="text-[11px] font-mono font-bold w-[180px]" style={{ color: "#1B5BDA" }}>{o.order_number}</span>
                  <span className="text-[12px] w-[120px]" style={{ color: "#1D2530" }}>{o.status}</span>
                  {o.is_forecast && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#EDE9FE", color: "#6D28D9" }} title="Commande prévisionnelle">
                      <CalendarClock size={9} /> Prévisionnel
                    </span>
                  )}
                  <span className="text-[12px] flex-1 truncate" style={{ color: "#616B7C" }} title={seller}>{seller}</span>
                  <span className="text-[12px] font-bold font-mono" style={{ color: "#1D2530" }}>{fmtEur(amountNum)} EUR</span>
                  <span className="text-[11px] w-[90px] text-right" style={{ color: "#8B95A5" }}>
                    {new Date(o.created_at).toLocaleDateString("fr-BE")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogistique;
