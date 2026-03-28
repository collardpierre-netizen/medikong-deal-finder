import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import VendorCommissionTab from "@/components/vendor/VendorCommissionTab";
import { Check, Eye, Edit2, AlertTriangle, Percent, BarChart3, Layers, Split } from "lucide-react";

const teamMembers = [
  { id: 1, name: "Pierre Collard", email: "pierre@pharmamed.be", role: "Admin", lastActive: "27/03 10:14", avatar: "PC" },
  { id: 2, name: "Sophie Dumont", email: "sophie@pharmamed.be", role: "Commercial", lastActive: "27/03 09:30", avatar: "SD" },
  { id: 3, name: "Marc Janssens", email: "marc@pharmamed.be", role: "Logistique", lastActive: "26/03 16:45", avatar: "MJ" },
];

const roleColors: Record<string, string> = { Admin: "#EF4343", Commercial: "#1B5BDA", Logistique: "#059669", "Lecture seule": "#616B7C" };

const documents = [
  { name: "Extrait BCE/KBO", status: "valid", expiry: "Permanent" },
  { name: "Attestation TVA", status: "valid", expiry: "Permanent" },
  { name: "Assurance RC Pro", status: "valid", expiry: "15/09/2026" },
  { name: "Licence distribution AFMPS", status: "valid", expiry: "30/06/2027" },
  { name: "Certificat CE (lot produits)", status: "warning", expiry: "15/04/2026" },
  { name: "IBAN verifie", status: "valid", expiry: "Permanent" },
];

const webhooks = [
  { event: "order.created", url: "https://erp.pharmamed.be/hooks/mk-order", lastCall: "27/03 09:14" },
  { event: "order.shipped", url: "https://erp.pharmamed.be/hooks/mk-ship", lastCall: "27/03 08:30" },
  { event: "offer.buybox_lost", url: "https://erp.pharmamed.be/hooks/mk-bb", lastCall: "26/03 14:22" },
];

const notifCategories = [
  {
    label: "Commandes", items: [
      { name: "Nouvelle commande", email: true, push: true, webhook: true },
      { name: "Commande expediee", email: false, push: true, webhook: true },
      { name: "Litige ouvert", email: true, push: true, webhook: true },
    ]
  },
  {
    label: "Offres & Prix", items: [
      { name: "Buy Box gagnee/perdue", email: true, push: true, webhook: true },
      { name: "Concurrent sous mon prix", email: true, push: true, webhook: false },
      { name: "Stock critique", email: true, push: true, webhook: true },
    ]
  },
  {
    label: "Finance", items: [
      { name: "Reversement effectue", email: true, push: false, webhook: false },
      { name: "Facture disponible", email: true, push: false, webhook: false },
    ]
  },
  {
    label: "Appels d'offres", items: [
      { name: "Nouvel AO matching", email: true, push: true, webhook: false },
      { name: "Resultat AO", email: true, push: true, webhook: false },
    ]
  },
];

export default function VendorSettings() {
  const [activeTab, setActiveTab] = useState("profile");
  const tabs = [
    { id: "profile", label: "Profil entreprise" },
    { id: "commission", label: "Commission" },
    { id: "team", label: "Equipe", badge: teamMembers.length },
    { id: "api", label: "API & Webhooks" },
    { id: "notifications", label: "Notifications" },
  ];

  const { data: commissionRules = [] } = useQuery({
    queryKey: ["vendor-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .or("vendor_id.is.null,is_default.eq.true")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const activeRule = commissionRules.find((r: any) => r.is_default) || commissionRules[0];

  const modelLabels: Record<string, string> = {
    fixed_rate: "Taux fixe",
    tiered_gmv: "Paliers GMV",
    category_based: "Par catégorie",
    margin_split: "Split marge",
  };

  const modelIcons: Record<string, React.ElementType> = {
    fixed_rate: Percent,
    tiered_gmv: BarChart3,
    category_based: Layers,
    margin_split: Split,
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1D2530]">Parametres</h1>
      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Informations entreprise</h3>
            <div className="space-y-3 text-[13px]">
              {[
                ["Raison sociale", "Pharmamed SA"],
                ["N° TVA", "BE0123.456.789"],
                ["Pays", "Belgique"],
                ["Membre depuis", "Juin 2024"],
                ["Niveau", "Gold"],
                ["Commission", "12%"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#8B95A5]">{k}</span>
                  <span className="font-medium text-[#1D2530]">{v}</span>
                </div>
              ))}
            </div>
            <VBtn small className="mt-4" icon="Pencil">Modifier</VBtn>
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Documents & Certificats</h3>
            <div className="space-y-2.5">
              {documents.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[13px]">
                  <span className="text-[#1D2530]">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#8B95A5]">{d.expiry}</span>
                    {d.status === "valid" ? (
                      <VBadge color="#059669">Valide</VBadge>
                    ) : (
                      <VBadge color="#F59E0B">Expire bientot</VBadge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </VCard>
        </div>
      )}

      {activeTab === "commission" && activeRule && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Votre modèle de commission actif</h3>
            <div className="flex items-center gap-3 mb-4">
              {(() => { const Icon = modelIcons[activeRule.model] || Percent; return <div className="w-10 h-10 rounded-lg bg-[#1B5BDA14] flex items-center justify-center"><Icon size={20} className="text-[#1B5BDA]" /></div>; })()}
              <div>
                <p className="font-semibold text-[#1D2530]">{activeRule.name}</p>
                <p className="text-[11px] text-[#8B95A5]">{modelLabels[activeRule.model] || activeRule.model}</p>
              </div>
            </div>
            <div className="space-y-2 text-[13px]">
              {activeRule.model === "fixed_rate" && (
                <div className="flex justify-between"><span className="text-[#8B95A5]">Taux</span><span className="font-semibold text-[#1D2530]">{activeRule.fixed_rate}%</span></div>
              )}
              {activeRule.model === "tiered_gmv" && (activeRule.tiers as any[])?.map((t: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[#8B95A5]">{t.to ? `${t.from.toLocaleString()}€ → ${t.to.toLocaleString()}€` : `> ${t.from.toLocaleString()}€`}</span>
                  <span className="font-semibold text-[#1D2530]">{t.rate}%</span>
                </div>
              ))}
              {activeRule.model === "category_based" && Object.entries(activeRule.category_rates || {}).map(([cat, rate]) => (
                <div key={cat} className="flex justify-between">
                  <span className="text-[#8B95A5]">{cat}</span>
                  <span className="font-semibold text-[#1D2530]">{String(rate)}%</span>
                </div>
              ))}
              {activeRule.model === "margin_split" && (
                <>
                  <div className="flex justify-between"><span className="text-[#8B95A5]">Part MediKong</span><span className="font-semibold text-[#1D2530]">{activeRule.margin_split_mk}%</span></div>
                  <div className="flex justify-between"><span className="text-[#8B95A5]">Votre part</span><span className="font-semibold text-[#059669]">{activeRule.margin_split_vendor}%</span></div>
                </>
              )}
            </div>
            {activeRule.notes && <p className="text-[11px] text-[#8B95A5] mt-3 border-t border-[#E2E8F0] pt-2">{activeRule.notes}</p>}
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Comment ça fonctionne</h3>
            <div className="space-y-3 text-[13px] text-[#616B7C]">
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="font-medium text-[#1D2530] mb-1">Taux fixe</p>
                <p>Un pourcentage unique prélevé sur chaque vente HT.</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="font-medium text-[#1D2530] mb-1">Paliers GMV</p>
                <p>Le taux diminue à mesure que votre volume mensuel augmente.</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="font-medium text-[#1D2530] mb-1">Par catégorie</p>
                <p>Chaque catégorie de produit a un taux de commission différent.</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="font-medium text-[#1D2530] mb-1">Split marge</p>
                <p>La marge entre le prix d'achat et le prix de vente est partagée entre vous et MediKong.</p>
              </div>
            </div>
          </VCard>
        </div>
      )}

      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1D2530]">Membres de l'equipe</h3>
            <VBtn primary small icon="UserPlus">Inviter un membre</VBtn>
          </div>

          <VCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2.5 px-3 font-medium">Membre</th>
                    <th className="text-left py-2.5 px-3 font-medium">Email</th>
                    <th className="text-left py-2.5 px-3 font-medium">Role</th>
                    <th className="text-left py-2.5 px-3 font-medium">Dernier acces</th>
                    <th className="text-right py-2.5 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(m => (
                    <tr key={m.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#1B5BDA14] flex items-center justify-center text-[11px] font-bold text-[#1B5BDA]">{m.avatar}</div>
                          <span className="font-medium text-[#1D2530]">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#616B7C]">{m.email}</td>
                      <td className="py-2.5 px-3"><VBadge color={roleColors[m.role]}>{m.role}</VBadge></td>
                      <td className="py-2.5 px-3 text-[#8B95A5]">{m.lastActive}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button className="p-1.5 hover:bg-[#F1F5F9] rounded"><Edit2 size={14} className="text-[#8B95A5]" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Roles disponibles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { role: "Admin", desc: "Acces complet" },
                { role: "Commercial", desc: "Offres, prix, catalogue, analytics" },
                { role: "Logistique", desc: "Commandes, expeditions, retours" },
                { role: "Lecture seule", desc: "Consultation uniquement" },
              ].map(r => (
                <div key={r.role} className="bg-[#F8FAFC] rounded-lg p-3">
                  <VBadge color={roleColors[r.role]}>{r.role}</VBadge>
                  <p className="text-[11px] text-[#616B7C] mt-1.5">{r.desc}</p>
                </div>
              ))}
            </div>
          </VCard>
        </div>
      )}

      {activeTab === "api" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Cles API</h3>
            <div className="space-y-3">
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="text-[11px] text-[#8B95A5] mb-1">API Key (Production)</p>
                <div className="flex items-center gap-2">
                  <code className="text-[13px] font-mono text-[#1D2530] flex-1">mk_live_••••••••••••4f2a</code>
                  <button className="p-1.5 hover:bg-[#E2E8F0] rounded"><Eye size={14} className="text-[#8B95A5]" /></button>
                </div>
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3">
                <p className="text-[11px] text-[#8B95A5] mb-1">API Key (Sandbox)</p>
                <div className="flex items-center gap-2">
                  <code className="text-[13px] font-mono text-[#1D2530] flex-1">mk_test_••••••••••••8b1c</code>
                  <button className="p-1.5 hover:bg-[#E2E8F0] rounded"><Eye size={14} className="text-[#8B95A5]" /></button>
                </div>
              </div>
            </div>
            <VBtn small className="mt-3" icon="RefreshCw">Regenerer les cles</VBtn>
            <p className="text-[11px] text-[#1B5BDA] mt-2 cursor-pointer hover:underline">docs.medikong.pro/api/v1</p>
          </VCard>

          <VCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1D2530]">Webhooks configures</h3>
            </div>
            <div className="space-y-3">
              {webhooks.map(w => (
                <div key={w.event} className="bg-[#F8FAFC] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <VBadge color="#059669">{w.event}</VBadge>
                    <VBadge color="#059669">Active</VBadge>
                  </div>
                  <code className="text-[11px] font-mono text-[#616B7C] block mb-1">{w.url}</code>
                  <p className="text-[10px] text-[#8B95A5]">Dernier appel : {w.lastCall}</p>
                </div>
              ))}
            </div>
            <VBtn small className="mt-3 w-full !justify-center" icon="Plus">Ajouter un webhook</VBtn>
          </VCard>
        </div>
      )}

      {activeTab === "notifications" && (
        <VCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2.5 px-3 font-medium w-1/2">Notification</th>
                  <th className="text-center py-2.5 px-3 font-medium">Email</th>
                  <th className="text-center py-2.5 px-3 font-medium">Push</th>
                  <th className="text-center py-2.5 px-3 font-medium">Webhook</th>
                </tr>
              </thead>
              <tbody>
                {notifCategories.map(cat => (
                  <>
                    <tr key={cat.label} className="bg-[#F8FAFC]">
                      <td colSpan={4} className="py-2 px-3 text-[11px] font-semibold text-[#1D2530] uppercase tracking-wide">{cat.label}</td>
                    </tr>
                    {cat.items.map(item => (
                      <tr key={item.name} className="border-b border-[#E2E8F0]">
                        <td className="py-2.5 px-3 text-[#616B7C]">{item.name}</td>
                        {[item.email, item.push, item.webhook].map((checked, ci) => (
                          <td key={ci} className="py-2.5 px-3 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer">
                              <div className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${
                                checked ? "bg-[#1B5BDA] border-[#1B5BDA]" : "bg-white border-[#CBD5E1]"
                              }`}>
                                {checked && <Check size={12} className="text-white" />}
                              </div>
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </VCard>
      )}
    </div>
  );
}
