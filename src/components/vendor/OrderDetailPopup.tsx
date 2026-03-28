import { useState } from "react";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProductIcon } from "@/components/vendor/ui/VProductIcon";
import { vendorOrders, orderAge } from "@/data/vendor-offers-mock";
import { buyerTypeColors } from "@/lib/vendor-tokens";
import { X, Clock, Copy, ExternalLink, Check, ChevronDown, ChevronUp } from "lucide-react";
import InvoicePreview from "@/components/vendor/InvoicePreview";

const statusLabels: Record<string, string> = { pending: "En attente", confirmed: "Confirmee", shipped: "Expediee", delivered: "Livree", dispute: "Litige" };
const statusColors: Record<string, string> = { pending: "#F59E0B", confirmed: "#1B5BDA", shipped: "#7C3AED", delivered: "#059669", dispute: "#EF4343" };
const timelineSteps = ["pending", "confirmed", "shipped", "delivered"];

const carriers = ["Bpost", "DHL", "TNT", "UPS", "Fedex", "GLS", "Mondial Relay"];

interface Props { orderId: string; onClose: () => void; }

export default function OrderDetailPopup({ orderId, onClose }: Props) {
  const order = vendorOrders.find(o => o.id === orderId);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState<"invoice" | "delivery" | null>(null);
  const [carrier, setCarrier] = useState(order?.tracking?.carrier || "Bpost");
  const [trackingNum, setTrackingNum] = useState(order?.tracking?.number || "");
  const [notifyBuyer, setNotifyBuyer] = useState(true);

  if (!order) return null;

  const age = orderAge(order.dateTs);
  const bt = buyerTypeColors[order.buyerType] || { text: "#616B7C", bg: "#616B7C18" };
  const stepIdx = timelineSteps.indexOf(order.status === "dispute" ? "delivered" : order.status);

  if (showInvoice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowInvoice(null)}>
        <div className="bg-white rounded-[10px] w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
            <h2 className="text-base font-bold text-[#1D2530]">{showInvoice === "invoice" ? "Apercu facture" : "Bon de livraison"}</h2>
            <button onClick={() => setShowInvoice(null)} className="p-1 hover:bg-[#F1F5F9] rounded"><X size={18} className="text-[#8B95A5]" /></button>
          </div>
          <InvoicePreview order={order} docType={showInvoice} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-[10px] w-full max-w-[760px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#1D2530]">{order.id}</h2>
            <VBadge color={statusColors[order.status]}>{statusLabels[order.status]}</VBadge>
            <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: age.color }}>
              <Clock size={12} /> {age.label}
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F1F5F9] rounded"><X size={18} className="text-[#8B95A5]" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Timeline */}
          <div className="flex items-center justify-between">
            {timelineSteps.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= stepIdx ? "text-white" : "text-[#CBD5E1] border-2 border-[#E2E8F0]"}`}
                    style={i <= stepIdx ? { backgroundColor: statusColors[step] } : {}}>
                    {i < stepIdx ? <Check size={12} /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 ${i <= stepIdx ? "text-[#1D2530] font-medium" : "text-[#CBD5E1]"}`}>{statusLabels[step]}</span>
                </div>
                {i < 3 && <div className={`flex-1 h-0.5 mx-1 ${i < stepIdx ? "bg-[#059669]" : "bg-[#E2E8F0]"}`} />}
              </div>
            ))}
          </div>

          {/* 3 info columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] font-medium text-[#8B95A5] uppercase tracking-wide mb-2">Client</p>
              <p className="font-semibold text-[#1D2530]">{order.buyer}</p>
              <VBadge color={bt.text} bg={bt.bg} className="mt-1">{order.buyerType}</VBadge>
              <div className="mt-2 space-y-0.5 text-[#616B7C]">
                <p>{order.contact.name}</p>
                <p>{order.contact.phone}</p>
                <p>{order.contact.email}</p>
              </div>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] font-medium text-[#8B95A5] uppercase tracking-wide mb-2">Livraison</p>
              <p className="text-[#1D2530]">{order.address.street}</p>
              <p className="text-[#1D2530]">{order.address.postal} {order.address.city}</p>
              <p className="text-[#616B7C] mt-1">Transporteur : {order.delivery}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] font-medium text-[#8B95A5] uppercase tracking-wide mb-2">Timing</p>
              <p className="text-[#616B7C]">Commande : {order.date}</p>
              <p className="text-[#1B5BDA] font-medium">Livraison promise : {order.promisedDelivery}</p>
              <p className="text-[#616B7C]">Paiement : {order.payTerms}</p>
            </div>
          </div>

          {/* Tracking bar */}
          {order.tracking && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-semibold text-[#1B5BDA]">{order.tracking.carrier}</span>
                <span className="font-mono text-[#616B7C]">{order.tracking.number}</span>
              </div>
              <div className="flex gap-2">
                <VBtn small icon="Copy">Copier le lien</VBtn>
                <VBtn small icon="ExternalLink">Voir le suivi</VBtn>
              </div>
            </div>
          )}

          {/* Lines table */}
          <div>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-2">Articles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[10px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2 px-2 font-medium w-6"></th>
                    <th className="text-left py-2 px-2 font-medium">Produit</th>
                    <th className="text-center py-2 px-2 font-medium">Qte</th>
                    <th className="text-center py-2 px-2 font-medium">Dispo</th>
                    <th className="text-right py-2 px-2 font-medium">P.U.</th>
                    <th className="text-right py-2 px-2 font-medium">Ligne</th>
                    <th className="text-left py-2 px-2 font-medium">Statut</th>
                    <th className="text-right py-2 px-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map(line => {
                    const expanded = expandedLine === line.sku;
                    return (
                      <>
                        <tr key={line.sku} className="border-b border-[#E2E8F0]">
                          <td className="py-2 px-2"><VProductIcon cat={line.cat} size={24} /></td>
                          <td className="py-2 px-2">
                            <p className="font-medium text-[#1D2530]">{line.name}</p>
                            <p className="font-mono text-[10px] text-[#8B95A5]">{line.sku}</p>
                          </td>
                          <td className="py-2 px-2 text-center font-medium">{line.qty}</td>
                          <td className="py-2 px-2 text-center font-medium" style={{ color: line.stockOk ? "#059669" : "#EF4343" }}>{line.qtyAvail}</td>
                          <td className="py-2 px-2 text-right">{line.unitPrice.toFixed(2)} EUR</td>
                          <td className="py-2 px-2 text-right font-medium">{line.lineTotal.toFixed(2)} EUR</td>
                          <td className="py-2 px-2">
                            {line.stockOk ? <VBadge color="#059669">OK</VBadge> : <VBadge color="#EF4343">Back order</VBadge>}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {line.stockOk ? (
                              <VBtn small className="!text-[10px]">Confirmer</VBtn>
                            ) : (
                              <div className="flex gap-1 justify-end">
                                <VBtn small className="!text-[10px]">Partiel ({line.qtyAvail})</VBtn>
                                {line.substitute && (
                                  <button onClick={() => setExpandedLine(expanded ? null : line.sku)} className="p-1 hover:bg-[#F1F5F9] rounded">
                                    {expanded ? <ChevronUp size={14} className="text-[#7C3AED]" /> : <ChevronDown size={14} className="text-[#7C3AED]" />}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {expanded && line.substitute && (
                          <tr key={`${line.sku}-sub`} className="bg-[#F5F3FF]">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[11px] text-[#7C3AED] font-medium mb-1">Produit substitut suggere</p>
                                  <p className="text-[12px] font-semibold text-[#1D2530]">{line.substitute.name}</p>
                                  <p className="text-[11px] text-[#616B7C]">{line.substitute.price.toFixed(2)} EUR/unite</p>
                                  {line.backorderEta && <p className="text-[11px] text-[#8B95A5] mt-1">Back order ETA : {line.backorderEta}</p>}
                                </div>
                                <VBtn small primary>Proposer ce substitut</VBtn>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-[13px]">
              <div className="flex justify-between"><span className="text-[#616B7C]">Total HT</span><span className="font-medium">{order.totalHT.toFixed(2)} EUR</span></div>
              <div className="flex justify-between"><span className="text-[#616B7C]">TVA</span><span>{order.tva.toFixed(2)} EUR</span></div>
              <div className="flex justify-between border-t border-[#E2E8F0] pt-1"><span className="font-bold">Total TTC</span><span className="font-bold text-[#1B5BDA]">{order.totalTTC.toFixed(2)} EUR</span></div>
            </div>
          </div>

          {/* Shipping section */}
          {order.status === "confirmed" && (
            <div className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Expedition</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Transporteur</label>
                  <select value={carrier} onChange={e => setCarrier(e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
                    {carriers.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">N° de suivi</label>
                  <input value={trackingNum} onChange={e => setTrackingNum(e.target.value)} placeholder="Numero de tracking" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[#616B7C] mb-3 cursor-pointer">
                <input type="checkbox" checked={notifyBuyer} onChange={e => setNotifyBuyer(e.target.checked)} className="rounded border-[#CBD5E1]" />
                Notifier l'acheteur par email
              </label>
              <VBtn primary icon="Truck">Confirmer l'expedition</VBtn>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 p-5 border-t border-[#E2E8F0]">
          {order.status === "pending" && <VBtn primary>Confirmer commande</VBtn>}
          {order.status === "shipped" && <VBtn primary>Marquer livree</VBtn>}
          <VBtn icon="MessageSquare">Contacter client</VBtn>
          <VBtn icon="FileText" onClick={() => setShowInvoice("invoice")}>Apercu facture</VBtn>
          <VBtn icon="Truck" onClick={() => setShowInvoice("delivery")}>Bon de livraison</VBtn>
          <VBtn onClick={onClose} className="ml-auto">Fermer</VBtn>
        </div>
      </div>
    </div>
  );
}
