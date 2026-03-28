import { useState } from "react";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { vendorOffers } from "@/data/vendor-offers-mock";
import { catalogProducts } from "@/data/vendor-mock";
import { vendorProfile } from "@/lib/vendor-tokens";
import { X } from "lucide-react";

interface EditOfferPopupProps {
  offerId?: string;
  onClose: () => void;
}

export default function EditOfferPopup({ offerId, onClose }: EditOfferPopupProps) {
  const existing = offerId ? vendorOffers.find(o => o.id === offerId) : null;
  const availableProducts = catalogProducts.filter(p => !vendorOffers.some(o => o.sku === p.sku) || existing?.sku === p.sku);

  const [selectedSku, setSelectedSku] = useState(existing?.sku || availableProducts[0]?.sku || "");
  const [priceHT, setPriceHT] = useState(existing?.price || 0);
  const [port, setPort] = useState(existing?.port || 4.90);
  const [moq, setMoq] = useState(existing?.moq || 1);
  const [mov, setMov] = useState(0);
  const [stock, setStock] = useState(existing?.stock || 0);
  const [stockAlert, setStockAlert] = useState(existing?.stockAlert || 10);

  const product = catalogProducts.find(p => p.sku === selectedSku);
  const commission = vendorProfile.commissionRate;
  const priceLivr = priceHT + port;
  const commissionAmount = priceHT * (commission / 100);
  const net = priceHT - commissionAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-[10px] w-full max-w-[640px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <h2 className="text-base font-bold text-[#1D2530]">{existing ? "Modifier l'offre" : "Nouvelle offre"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#F1F5F9] rounded"><X size={18} className="text-[#8B95A5]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Produit</label>
            <select value={selectedSku} onChange={e => setSelectedSku(e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
              {availableProducts.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}
            </select>
            {product && (
              <div className="flex gap-4 mt-2 text-[11px] text-[#8B95A5]">
                <span>EAN: {product.ean}</span>
                <span>CNK: {product.cnk}</span>
                <span>{product.conditioning}</span>
                <span>TVA: {product.tva}%</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Prix HT (EUR)</label>
              <input type="number" value={priceHT} onChange={e => setPriceHT(+e.target.value)} step="0.01" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Frais de port (EUR)</label>
              <input type="number" value={port} onChange={e => setPort(+e.target.value)} step="0.01" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">MOQ</label>
              <input type="number" value={moq} onChange={e => setMoq(+e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">MOV (EUR)</label>
              <input type="number" value={mov} onChange={e => setMov(+e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Stock actuel</label>
              <input type="number" value={stock} onChange={e => setStock(+e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Seuil alerte stock</label>
              <input type="number" value={stockAlert} onChange={e => setStockAlert(+e.target.value)} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
          </div>

          {/* Net preview */}
          <div className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
            <p className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide mb-2">Apercu "Net en poche"</p>
            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between"><span className="text-[#616B7C]">Votre prix HT</span><span>{priceHT.toFixed(2)} EUR</span></div>
              <div className="flex justify-between"><span className="text-[#616B7C]">+ Frais de port</span><span>{port.toFixed(2)} EUR</span></div>
              <div className="flex justify-between font-medium"><span>= Prix livre HT</span><span>{priceLivr.toFixed(2)} EUR</span></div>
              <div className="flex justify-between text-[#EF4343]"><span>- Commission MediKong ({commission}%)</span><span>-{commissionAmount.toFixed(2)} EUR</span></div>
              <div className="flex justify-between border-t border-[#E2E8F0] pt-1 mt-1">
                <span className="font-bold text-[#059669]">Net en poche</span>
                <span className="font-bold text-[#059669] text-lg">{net.toFixed(2)} EUR</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-[#E2E8F0]">
          <VBtn onClick={onClose}>Annuler</VBtn>
          <VBtn primary>{existing ? "Enregistrer" : "Creer l'offre"}</VBtn>
        </div>
      </div>
    </div>
  );
}
