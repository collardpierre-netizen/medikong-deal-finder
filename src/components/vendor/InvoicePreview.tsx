import { vendorProfile } from "@/lib/vendor-tokens";

interface OrderLine {
  sku: string; name: string; cat: string; qty: number; unitPrice: number; lineTotal: number;
  stockOk: boolean; qtyAvail: number; backorderEta?: string;
  substitute?: { sku: string; name: string; price: number };
}

interface Order {
  id: string; buyer: string; buyerType: string;
  totalHT: number; tva: number; totalTTC: number;
  date: string; payTerms: string;
  contact: { name: string; phone: string; email: string };
  address: { street: string; city: string; postal: string; country: string };
  lines: OrderLine[];
}

interface Props { order: Order; docType: "invoice" | "delivery"; }

export default function InvoicePreview({ order, docType }: Props) {
  const isInvoice = docType === "invoice";

  // Split lines by TVA rate for ventilation
  const lines6 = order.lines.filter(l => {
    const cats6 = ["Diagnostic", "Injection", "Pansements"];
    return cats6.includes(l.cat);
  });
  const lines21 = order.lines.filter(l => !lines6.includes(l));
  const totalHT6 = lines6.reduce((s, l) => s + l.lineTotal, 0);
  const totalHT21 = lines21.reduce((s, l) => s + l.lineTotal, 0);
  const tva6 = totalHT6 * 0.06;
  const tva21 = totalHT21 * 0.21;

  return (
    <div className="p-6 text-[12px] text-[#1D2530]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Header band */}
      <div className="bg-[#2B4C9B] text-white rounded-t-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E70866] rounded-md flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="text-lg font-bold">MediKong</span>
        </div>
        <span className="text-sm font-semibold uppercase tracking-wider">{isInvoice ? "Facture finale" : "Bon de livraison"}</span>
      </div>

      {/* 3 columns */}
      <div className="grid grid-cols-3 gap-4 mt-5 text-[11px]">
        <div>
          <p className="text-[10px] font-medium text-[#8B95A5] uppercase tracking-wide mb-1">Emetteur</p>
          <p className="font-semibold">Balooh SRL</p>
          <p>23 rue de la Procession</p>
          <p>B-7822 Ath, Belgique</p>
          <p>TVA: BE 1005.771.323</p>
          <p className="text-[#1B5BDA]">www.medikong.pro</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#8B95A5] uppercase tracking-wide mb-1">Vendeur</p>
          <p className="font-semibold">{vendorProfile.name}</p>
          <p>TVA: {vendorProfile.vat}</p>
          <p>Pays: {vendorProfile.country}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[#8B95A5] uppercase tracking-wide mb-1">Acheteur</p>
          <p className="font-semibold">{order.buyer}</p>
          <p>{order.contact.name}</p>
          <p>{order.address.street}</p>
          <p>{order.address.postal} {order.address.city}</p>
        </div>
      </div>

      {/* Yellow band */}
      <div className="bg-[#D4A843] text-white rounded px-4 py-2 mt-4 text-[11px] font-medium text-center">
        {isInvoice
          ? `Facture emise par MediKong (Balooh SRL) pour le compte et au nom de ${vendorProfile.name}`
          : `Bon de livraison emis par MediKong (Balooh SRL) pour le compte de ${vendorProfile.name}`}
      </div>

      {/* Doc info */}
      <div className="flex gap-6 mt-4 text-[11px]">
        <div><span className="text-[#8B95A5]">N° Document : </span><span className="font-medium">{isInvoice ? `FACT-${order.id.replace("CMD-", "")}` : `BL-${order.id.replace("CMD-", "")}`}</span></div>
        <div><span className="text-[#8B95A5]">Date : </span><span className="font-medium">{order.date}</span></div>
        {isInvoice && <div><span className="text-[#8B95A5]">Paiement : </span><span className="font-medium">{order.payTerms}</span></div>}
      </div>

      {/* Lines table (invoice only) */}
      {isInvoice && (
        <table className="w-full mt-4 text-[11px]">
          <thead>
            <tr className="border-b-2 border-[#2B4C9B] text-[10px] text-[#8B95A5] uppercase tracking-wide">
              <th className="text-left py-2 font-medium">Description</th>
              <th className="text-left py-2 font-medium">CNK</th>
              <th className="text-center py-2 font-medium">Qte</th>
              <th className="text-right py-2 font-medium">P.U. HT</th>
              <th className="text-center py-2 font-medium">TVA%</th>
              <th className="text-right py-2 font-medium">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map(l => {
              const cats6 = ["Diagnostic", "Injection", "Pansements"];
              const tvaRate = cats6.includes(l.cat) ? 6 : 21;
              return (
                <tr key={l.sku} className="border-b border-[#E2E8F0]">
                  <td className="py-2 text-[#1D2530]">{l.name}</td>
                  <td className="py-2 font-mono text-[#8B95A5]">{l.sku}</td>
                  <td className="py-2 text-center">{l.qty}</td>
                  <td className="py-2 text-right">{l.unitPrice.toFixed(2)} EUR</td>
                  <td className="py-2 text-center">{tvaRate}%</td>
                  <td className="py-2 text-right font-medium">{l.lineTotal.toFixed(2)} EUR</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Delivery lines (simplified) */}
      {!isInvoice && (
        <table className="w-full mt-4 text-[11px]">
          <thead>
            <tr className="border-b-2 border-[#2B4C9B] text-[10px] text-[#8B95A5] uppercase tracking-wide">
              <th className="text-left py-2 font-medium">Description</th>
              <th className="text-left py-2 font-medium">SKU</th>
              <th className="text-center py-2 font-medium">Qte commandee</th>
              <th className="text-center py-2 font-medium">Qte livree</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map(l => (
              <tr key={l.sku} className="border-b border-[#E2E8F0]">
                <td className="py-2">{l.name}</td>
                <td className="py-2 font-mono text-[#8B95A5]">{l.sku}</td>
                <td className="py-2 text-center">{l.qty}</td>
                <td className="py-2 text-center font-medium" style={{ color: l.stockOk ? "#059669" : "#EF4343" }}>{l.stockOk ? l.qty : l.qtyAvail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* TVA ventilation (invoice only) */}
      {isInvoice && (
        <div className="flex justify-end mt-4">
          <div className="w-72 text-[11px]">
            {totalHT6 > 0 && (
              <>
                <div className="flex justify-between"><span className="text-[#616B7C]">Total HT (6%)</span><span>{totalHT6.toFixed(2)} EUR</span></div>
                <div className="flex justify-between"><span className="text-[#616B7C]">TVA 6%</span><span>{tva6.toFixed(2)} EUR</span></div>
              </>
            )}
            {totalHT21 > 0 && (
              <>
                <div className="flex justify-between mt-1"><span className="text-[#616B7C]">Total HT (21%)</span><span>{totalHT21.toFixed(2)} EUR</span></div>
                <div className="flex justify-between"><span className="text-[#616B7C]">TVA 21%</span><span>{tva21.toFixed(2)} EUR</span></div>
              </>
            )}
            <div className="border-t border-[#E2E8F0] mt-2 pt-2 space-y-1">
              <div className="flex justify-between"><span className="text-[#616B7C]">Total HT</span><span className="font-medium">{order.totalHT.toFixed(2)} EUR</span></div>
              <div className="flex justify-between"><span className="text-[#616B7C]">Total TVA</span><span>{order.tva.toFixed(2)} EUR</span></div>
              <div className="flex justify-between text-sm font-bold text-[#2B4C9B] border-t border-[#2B4C9B] pt-1 mt-1">
                <span>TOTAL A PAYER</span><span>{order.totalTTC.toFixed(2)} EUR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank details (invoice only) */}
      {isInvoice && (
        <div className="bg-[#F8FAFC] rounded-lg p-3 mt-4 text-[11px]">
          <p className="font-medium text-[#1D2530] mb-1">Coordonnees bancaires</p>
          <div className="grid grid-cols-2 gap-1 text-[#616B7C]">
            <p>IBAN: BE13 6451 1047 3739</p>
            <p>BIC: KREDBEBB</p>
            <p>Beneficiaire: Balooh SRL</p>
            <p>Communication: {order.id}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#E2E8F0] mt-6 pt-3 text-center text-[10px] text-[#8B95A5]">
        Balooh SRL | TVA BE 1005.771.323 | 23 rue de la Procession, B-7822 Ath | www.medikong.pro
      </div>
    </div>
  );
}
