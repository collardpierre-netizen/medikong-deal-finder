import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { Search } from "lucide-react";

const messages = [
  { id: 1, from: "Pharmacie Centrale", subject: "Delai livraison gants?", product: "Gants Nitrile M x200", date: "27/03 09:30", unread: true, type: "question" as const, body: "Bonjour,\n\nNous avons passe une commande de 500 boites de gants nitrile M. Pourriez-vous nous confirmer le delai de livraison prevu ?\n\nNous avons besoin de les recevoir avant le 01/04 si possible.\n\nCordialement,\nPharmacien en chef" },
  { id: 2, from: "Hopital St-Luc", subject: "Demande devis volume", product: null, date: "26/03 15:10", unread: true, type: "devis" as const, body: "Bonjour,\n\nNous souhaitons recevoir un devis pour une commande groupee comprenant du materiel de diagnostic et des consommables.\n\nMerci de nous contacter pour en discuter.\n\nService achats" },
  { id: 3, from: "MediKong Support", subject: "Certificat CE expire bientot", product: "Thermometre IR Pro", date: "25/03 11:00", unread: false, type: "system" as const, body: "Votre certificat CE pour le lot de produits Thermometre Infrarouge Pro expire le 15/04/2026.\n\nVeuillez mettre a jour vos documents dans les parametres de votre compte avant cette date pour eviter toute interruption de vente." },
  { id: 4, from: "MRS Les Tilleuls", subject: "Contre-offre: Desinfectant", product: "Desinfectant Surface 5L", date: "24/03 14:20", unread: false, type: "negotiation" as const, body: "Suite a votre offre a 22,50 EUR/unite, nous souhaitons negocier un prix de 19,00 EUR pour une commande de 150 unites livrees mensuellement.\n\nEtes-vous ouverts a cette proposition ?" },
];

const typeBadge: Record<string, { color: string; label: string }> = {
  question: { color: "#1B5BDA", label: "Question" },
  devis: { color: "#F59E0B", label: "Devis" },
  system: { color: "#616B7C", label: "Systeme" },
  negotiation: { color: "#7C3AED", label: "Negociation" },
};

export default function VendorMessages() {
  const [selectedId, setSelectedId] = useState(messages[0].id);
  const [search, setSearch] = useState("");
  const selected = messages.find(m => m.id === selectedId) || messages[0];
  const unreadCount = messages.filter(m => m.unread).length;

  const filtered = messages.filter(m =>
    m.from.toLowerCase().includes(search.toLowerCase()) ||
    m.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#1D2530]">Messages</h1>
          {unreadCount > 0 && <VBadge color="#E70866">{unreadCount} non lus</VBadge>}
        </div>
        <VBtn primary icon="SquarePen">Nouveau message</VBtn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 500 }}>
        {/* Left - List */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white"
            />
          </div>
          <div className="space-y-1.5">
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left rounded-lg p-3 transition-colors ${
                  selectedId === m.id ? "bg-[#1B5BDA08] border border-[#1B5BDA30]" : m.unread ? "bg-[#F8FAFC] border border-[#E2E8F0]" : "bg-white border border-[#E2E8F0]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[13px] ${m.unread ? "font-bold text-[#1D2530]" : "font-medium text-[#616B7C]"}`}>{m.from}</span>
                  <span className="text-[10px] text-[#8B95A5]">{m.date}</span>
                </div>
                <p className="text-[12px] text-[#1D2530] truncate">{m.subject}</p>
                {m.product && <p className="text-[10px] text-[#8B95A5] mt-0.5 truncate">{m.product}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Right - Detail */}
        <div className="lg:col-span-2">
          <VCard className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-[15px] font-bold text-[#1D2530]">{selected.from}</p>
                <p className="text-[13px] text-[#616B7C] mt-0.5">{selected.subject}</p>
                {selected.product && <p className="text-[11px] text-[#8B95A5] mt-0.5">{selected.product}</p>}
              </div>
              <VBadge color={typeBadge[selected.type].color}>{typeBadge[selected.type].label}</VBadge>
            </div>

            {/* Body */}
            <div className="bg-[#F8FAFC] rounded-lg p-4 text-[13px] text-[#616B7C] whitespace-pre-line flex-1 mb-4">
              {selected.body}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap mb-4">
              <VBtn small primary icon="Reply">Repondre</VBtn>
              <VBtn small icon="FileText">Envoyer un devis</VBtn>
              <VBtn small icon="Tag">Creer une offre dediee</VBtn>
            </div>

            {/* Counter-offer (for negotiation type) */}
            {selected.type === "negotiation" && (
              <div className="border-2 border-dashed border-[#7C3AED40] rounded-lg p-4" style={{ backgroundColor: "#7C3AED06" }}>
                <p className="text-[12px] font-semibold text-[#7C3AED] mb-3">Contre-offre structuree</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-medium text-[#616B7C] uppercase tracking-wide">Quantite</label>
                    <input type="number" placeholder="150" className="w-full mt-1 px-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[#616B7C] uppercase tracking-wide">Prix unit. livre (EUR)</label>
                    <input type="number" step="0.01" placeholder="20,00" className="w-full mt-1 px-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[#616B7C] uppercase tracking-wide">Delai</label>
                    <input type="text" placeholder="2-3 jours" className="w-full mt-1 px-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[#616B7C] uppercase tracking-wide">Conditions</label>
                    <select className="w-full mt-1 px-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
                      <option>Comptant</option>
                      <option>Net 30</option>
                    </select>
                  </div>
                </div>
                <VBtn small primary icon="Send">Envoyer la contre-offre</VBtn>
              </div>
            )}
          </VCard>
        </div>
      </div>
    </div>
  );
}
