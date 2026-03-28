import { X, TrendingDown, TrendingUp, Minus, Info, Layers, Calendar, Database } from "lucide-react";
import { mockPrixPublicByProduct, mockPrixParProfilByProduct } from "@/lib/mock/prix-ref-mock";
import { getPrixRef, calcSavings, formatPrixRef, sourceLabels, profilLabels, paysLabels } from "@/lib/utils/prix-ref";
import type { ProfilAcheteur, PaysCode } from "@/lib/types/prix-informatifs";

interface Props {
  offer: {
    id: string; name: string; ean: string; priceLivr: number;
    price: number; port: number; commission: number;
  };
  onClose: () => void;
}

const allProfils: ProfilAcheteur[] = ["Pharmacie", "Hopital", "MRS", "Infirmier", "Cabinet", "Parapharmacie"];
const allPays: PaysCode[] = ["BE", "LU", "FR", "NL"];

export default function PrixRefDetailPopup({ offer, onClose }: Props) {
  const profilData = mockPrixParProfilByProduct[offer.name];
  const pubData = mockPrixPublicByProduct[offer.name];

  // Build matrix: profil × pays
  const matrix = allProfils.map(profil => ({
    profil,
    pays: allPays.map(pays => {
      const ref = getPrixRef(profilData, pubData, profil, pays);
      const savings = ref ? calcSavings(ref.price, offer.priceLivr, ref.source, ref.date) : null;
      const direct = profilData?.find(p => p.profil === profil && p.pays === pays && p.actif);
      return { pays, ref, savings, isDirect: !!direct };
    }),
  }));

  // Pricing Coach recommendations
  const recommendations: { text: string; severity: "danger" | "warning" | "success" }[] = [];
  const pharma = getPrixRef(profilData, pubData, "Pharmacie", "BE");
  const hop = getPrixRef(profilData, pubData, "Hopital", "BE");

  if (pharma && offer.priceLivr > pharma.price) {
    const pct = Math.round(((offer.priceLivr - pharma.price) / pharma.price) * 100);
    const target = (pharma.price * 0.98).toFixed(2);
    recommendations.push({
      text: `Votre prix livré (${formatPrixRef(offer.priceLivr)}) est ${pct}% au-dessus du ref. Pharmacie BE (${formatPrixRef(pharma.price)}). Baissez à ${formatPrixRef(+target)} pour être compétitif.`,
      severity: pct > 10 ? "danger" : "warning",
    });
  }
  if (hop && offer.priceLivr > hop.price) {
    const pct = Math.round(((offer.priceLivr - hop.price) / hop.price) * 100);
    recommendations.push({
      text: `Prix ${pct}% au-dessus du ref. Hôpital BE (${formatPrixRef(hop.price)}). Les marchés publics sont très sensibles au prix.`,
      severity: pct > 15 ? "danger" : "warning",
    });
  }
  if (pharma && offer.priceLivr <= pharma.price) {
    const pct = Math.round(((pharma.price - offer.priceLivr) / pharma.price) * 100);
    recommendations.push({
      text: `Bien positionné : ${pct}% sous le ref. Pharmacie BE. Bonne compétitivité.`,
      severity: "success",
    });
  }
  if (!profilData || profilData.length === 0) {
    recommendations.push({
      text: "Aucun prix de référence par profil pour ce produit. Seul le prix public HTVA est disponible.",
      severity: "warning",
    });
  }

  const commissionRate = offer.commission;
  const netAfterCommission = offer.price * (1 - commissionRate / 100);

  const sevColors = { danger: "#EF4343", warning: "#F59E0B", success: "#059669" };
  const sevBg = { danger: "#FEF2F2", warning: "#FFFBEB", success: "#F0FDF4" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-start justify-between z-10 rounded-t-xl">
          <div>
            <h2 className="text-[16px] font-bold text-[#1D2530]">{offer.name}</h2>
            <p className="text-[12px] text-[#8B95A5] mt-0.5">EAN {offer.ean} · Prix livré : <strong className="text-[#1D2530]">{formatPrixRef(offer.priceLivr)}</strong></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#8B95A5]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center border border-[#E2E8F0]">
              <p className="text-[10px] text-[#8B95A5] uppercase tracking-wide mb-1">Prix HT</p>
              <p className="text-[16px] font-bold text-[#1D2530]">{formatPrixRef(offer.price)}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center border border-[#E2E8F0]">
              <p className="text-[10px] text-[#8B95A5] uppercase tracking-wide mb-1">+ Port</p>
              <p className="text-[16px] font-bold text-[#1D2530]">{formatPrixRef(offer.port)}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center border border-[#E2E8F0]">
              <p className="text-[10px] text-[#8B95A5] uppercase tracking-wide mb-1">Net (après {commissionRate}%)</p>
              <p className="text-[16px] font-bold text-[#059669]">{formatPrixRef(netAfterCommission)}</p>
            </div>
          </div>

          {/* Prix public */}
          {pubData && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <Database size={14} className="text-[#8B95A5] shrink-0" />
              <div className="flex-1">
                <p className="text-[12px] text-[#8B95A5]">Prix public de référence</p>
                <p className="text-[13px] font-semibold text-[#1D2530]">
                  TTC : {formatPrixRef(pubData.ttc)} · HTVA : {formatPrixRef(pubData.htva)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#8B95A5]">{sourceLabels[pubData.source]}</p>
                <p className="text-[10px] text-[#CBD5E1]">{pubData.dateConstatation}</p>
              </div>
            </div>
          )}

          {/* Matrix: all profiles × all countries */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-[#1B5BDA]" />
              <h3 className="text-[13px] font-bold text-[#1D2530]">Prix de référence par profil et pays</h3>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-[#8B95A5] uppercase">Profil</th>
                    {allPays.map(p => (
                      <th key={p} className="text-center py-2.5 px-2 text-[10px] font-semibold text-[#8B95A5] uppercase">{paysLabels[p]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.profil} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC]">
                      <td className="py-2.5 px-3 font-medium text-[#1D2530]">{profilLabels[row.profil]}</td>
                      {row.pays.map(cell => {
                        if (!cell.ref) {
                          return (
                            <td key={cell.pays} className="py-2.5 px-2 text-center">
                              <span className="text-[#CBD5E1]">—</span>
                            </td>
                          );
                        }
                        const pct = cell.savings?.pct ?? 0;
                        const isBelow = pct > 0;
                        const isAbove = pct < 0;
                        const color = isBelow ? "#059669" : isAbove ? "#EF4343" : "#8B95A5";
                        const Icon = isBelow ? TrendingDown : isAbove ? TrendingUp : Minus;
                        return (
                          <td key={cell.pays} className="py-2.5 px-2 text-center">
                            <p className="text-[11px] text-[#8B95A5]">{formatPrixRef(cell.ref.price)}</p>
                            <div className="flex items-center justify-center gap-1">
                              <Icon size={10} style={{ color }} />
                              <span className="text-[11px] font-bold" style={{ color }}>
                                {isBelow ? `-${pct}%` : isAbove ? `+${Math.abs(pct)}%` : "="}
                              </span>
                            </div>
                            <p className="text-[9px] text-[#CBD5E1] mt-0.5">
                              {sourceLabels[cell.ref.source]}
                              {cell.isDirect ? "" : " *"}
                            </p>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-[#CBD5E1] mt-2">* Fallback vers profil+BE ou prix public HTVA quand pas de prix direct pour ce pays.</p>
          </div>

          {/* Pricing Coach Recommendations */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-indigo-700" />
              <h3 className="text-[13px] font-bold text-indigo-700">Pricing Coach — Recommandations</h3>
            </div>
            {recommendations.length === 0 ? (
              <p className="text-[12px] text-[#8B95A5]">Aucune recommandation pour ce produit.</p>
            ) : (
              <ul className="space-y-2">
                {recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] rounded-md p-2.5" style={{ backgroundColor: sevBg[r.severity] }}>
                    <span className="mt-0.5 shrink-0">
                      {r.severity === "danger" ? <TrendingUp size={13} style={{ color: sevColors[r.severity] }} /> :
                       r.severity === "warning" ? <Info size={13} style={{ color: sevColors[r.severity] }} /> :
                       <TrendingDown size={13} style={{ color: sevColors[r.severity] }} />}
                    </span>
                    <span style={{ color: sevColors[r.severity] === "#059669" ? "#1D2530" : sevColors[r.severity] }}>
                      {r.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Raw data if available */}
          {profilData && profilData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-[#8B95A5]" />
                <h3 className="text-[12px] font-semibold text-[#8B95A5]">Données sources détaillées</h3>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] text-[#8B95A5] uppercase">
                      <th className="text-left py-2 px-3 font-medium">Profil</th>
                      <th className="text-left py-2 px-2 font-medium">Pays</th>
                      <th className="text-right py-2 px-2 font-medium">Prix HT</th>
                      <th className="text-left py-2 px-2 font-medium">Source</th>
                      <th className="text-left py-2 px-2 font-medium">Mise à jour</th>
                      <th className="text-center py-2 px-2 font-medium">Actif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profilData.map(p => (
                      <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0">
                        <td className="py-2 px-3 font-medium text-[#1D2530]">{profilLabels[p.profil]}</td>
                        <td className="py-2 px-2 text-[#616B7C]">{paysLabels[p.pays]}</td>
                        <td className="py-2 px-2 text-right font-semibold text-[#1D2530]">{formatPrixRef(p.prixHT)}</td>
                        <td className="py-2 px-2 text-[#8B95A5]">{sourceLabels[p.source]}</td>
                        <td className="py-2 px-2 text-[#8B95A5]">{p.dateMAJ}</td>
                        <td className="py-2 px-2 text-center">
                          {p.actif
                            ? <span className="inline-block w-2 h-2 rounded-full bg-[#059669]" />
                            : <span className="inline-block w-2 h-2 rounded-full bg-[#CBD5E1]" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
