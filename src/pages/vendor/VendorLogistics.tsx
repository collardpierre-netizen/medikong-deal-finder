import { VCard } from "@/components/vendor/ui/VCard";
import { VStat } from "@/components/vendor/ui/VStat";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";

const pendingShipments = [
  { id: "CMD-2026-234", buyer: "Pharmacie du Parc", items: 3, carrier: "Bpost" },
  { id: "CMD-2026-233", buyer: "Hopital Erasme", items: 5, carrier: "DHL Express" },
  { id: "CMD-2026-232", buyer: "MRS Les Tilleuls", items: 2, carrier: "Bpost" },
];

const carriers = [
  { name: "Bpost", type: "Standard", zones: "BE", delay: "24-48h", active: true },
  { name: "PostNL", type: "Standard", zones: "BE, NL", delay: "48-72h", active: true },
  { name: "DHL Express", type: "Express", zones: "BE, LU, FR, NL", delay: "24h", active: true },
  { name: "GLS", type: "Standard", zones: "BE, LU", delay: "48h", active: false },
];

const deliveryHistory = [
  { order: "CMD-2026-228", buyer: "Pharmacie Centrale", carrier: "Bpost", shipped: "18/03", delivered: "19/03", delay: "1.0j", status: "delivered" },
  { order: "CMD-2026-225", buyer: "Hopital St-Luc", carrier: "DHL Express", shipped: "15/03", delivered: "15/03", delay: "0.5j", status: "delivered" },
  { order: "CMD-2026-222", buyer: "MRS Armonea", carrier: "PostNL", shipped: "12/03", delivered: "15/03", delay: "3.0j", status: "late" },
  { order: "CMD-2026-220", buyer: "Cabinet Janssen", carrier: "Bpost", shipped: "10/03", delivered: "11/03", delay: "1.2j", status: "delivered" },
  { order: "CMD-2026-218", buyer: "Pharmacie du Parc", carrier: "Bpost", shipped: "08/03", delivered: null, delay: "—", status: "returned" },
];

const carrierPerf = [
  { name: "Bpost", deliveries: 28, onTime: 26, returns: 1, avgDelay: "1,4j", rating: 93 },
  { name: "DHL Express", deliveries: 14, onTime: 14, returns: 0, avgDelay: "0,7j", rating: 100 },
  { name: "PostNL", deliveries: 4, onTime: 3, returns: 1, avgDelay: "2,1j", rating: 75 },
  { name: "GLS", deliveries: 2, onTime: 2, returns: 0, avgDelay: "1,8j", rating: 100 },
];

const statusColors: Record<string, string> = { delivered: "#059669", late: "#EF4343", returned: "#F59E0B" };
const statusLabels: Record<string, string> = { delivered: "Livre", late: "En retard", returned: "Retour" };

export default function VendorLogistics() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Logistique</h1>
        <VBtn icon="Settings">Configuration transport</VBtn>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VStat label="A expedier" value="3" icon="Package" color="#F59E0B" />
        <VStat label="En transit" value="5" icon="Truck" color="#1B5BDA" />
        <VStat label="Livrees (mois)" value="48" icon="CheckCircle" color="#059669" />
        <VStat label="Delai moyen" value="1,8j" icon="Clock" color="#059669" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left - Pending */}
        <VCard>
          <h3 className="text-sm font-semibold text-[#1D2530] mb-3">A expedier aujourd'hui</h3>
          <div className="space-y-3">
            {pendingShipments.map(s => (
              <div key={s.id} className="bg-[#F8FAFC] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1D2530]">{s.id}</p>
                    <p className="text-[12px] text-[#616B7C]">{s.buyer} · {s.items} articles</p>
                  </div>
                  <VBadge color="#1B5BDA">{s.carrier}</VBadge>
                </div>
                <div className="flex gap-2">
                  <VBtn small primary icon="Printer">Imprimer etiquette</VBtn>
                  <VBtn small icon="Check">Confirmer expedition</VBtn>
                </div>
              </div>
            ))}
          </div>
        </VCard>

        {/* Right - Carriers */}
        <VCard>
          <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Transporteurs configures</h3>
          <div className="space-y-2">
            {carriers.map(c => (
              <div key={c.name} className={`flex items-center justify-between bg-[#F8FAFC] rounded-lg p-3 ${!c.active ? "opacity-50" : ""}`}>
                <div>
                  <p className="text-[13px] font-semibold text-[#1D2530]">{c.name}</p>
                  <p className="text-[11px] text-[#8B95A5]">{c.type} · {c.zones} · {c.delay}</p>
                </div>
                <VBadge color={c.active ? "#059669" : "#616B7C"}>{c.active ? "Actif" : "Inactif"}</VBadge>
              </div>
            ))}
          </div>
          <VBtn small className="mt-3 w-full !justify-center" icon="Plus">Ajouter un transporteur</VBtn>
        </VCard>
      </div>

      {/* Delivery history */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Historique des livraisons (30 derniers jours)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#F0FDF4] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#059669]">48</p>
            <p className="text-[10px] text-[#8B95A5]">Livrees</p>
          </div>
          <div className="bg-[#EFF6FF] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#1B5BDA]">1,8j</p>
            <p className="text-[10px] text-[#8B95A5]">Delai moyen</p>
          </div>
          <div className="bg-[#FFFBEB] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#F59E0B]">2</p>
            <p className="text-[10px] text-[#8B95A5]">Retours</p>
          </div>
          <div className="bg-[#F0FDF4] rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-[#059669]">95,8%</p>
            <p className="text-[10px] text-[#8B95A5]">A temps</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                <th className="text-left py-2 px-3 font-medium">Commande</th>
                <th className="text-left py-2 px-3 font-medium">Acheteur</th>
                <th className="text-left py-2 px-3 font-medium">Transporteur</th>
                <th className="text-left py-2 px-3 font-medium">Expedie</th>
                <th className="text-left py-2 px-3 font-medium">Livre</th>
                <th className="text-left py-2 px-3 font-medium">Delai</th>
                <th className="text-left py-2 px-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {deliveryHistory.map(d => (
                <tr key={d.order} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-[#8B95A5]">{d.order}</td>
                  <td className="py-2.5 px-3 font-medium text-[#1D2530]">{d.buyer}</td>
                  <td className="py-2.5 px-3"><VBadge color="#1B5BDA">{d.carrier}</VBadge></td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{d.shipped}</td>
                  <td className="py-2.5 px-3 text-[#616B7C]">{d.delivered || "—"}</td>
                  <td className="py-2.5 px-3 font-medium" style={{ color: d.status === "late" ? "#EF4343" : "#1D2530" }}>{d.delay}</td>
                  <td className="py-2.5 px-3"><VBadge color={statusColors[d.status]}>{statusLabels[d.status]}</VBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VCard>

      {/* Carrier performance */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Performance par transporteur</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {carrierPerf.map(c => {
            const ratingColor = c.rating >= 95 ? "#059669" : c.rating >= 80 ? "#F59E0B" : "#EF4343";
            return (
              <div key={c.name} className="bg-[#F8FAFC] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-semibold text-[#1D2530]">{c.name}</p>
                  <VBadge color={ratingColor}>{c.rating}%</VBadge>
                </div>
                <div className="space-y-1 text-[11px] text-[#616B7C] mb-2">
                  <p>{c.deliveries} livraisons · {c.onTime} a temps · {c.returns} retour{c.returns !== 1 ? "s" : ""}</p>
                  <p className="font-medium text-[#1D2530]">Delai moyen : {c.avgDelay}</p>
                </div>
                <VProgressBar value={c.rating} color={ratingColor} height={4} />
              </div>
            );
          })}
        </div>
      </VCard>
    </div>
  );
}
