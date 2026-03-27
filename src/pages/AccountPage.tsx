import { Layout } from "@/components/layout/Layout";
import { ProductImage } from "@/components/shared/ProductCard";
import { Users, MapPin, Package, AlertCircle, Heart, Zap, Download, Layers, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { products, formatPrice } from "@/data/mock";

const tabs = [
  { key: "profil", label: "Profil", icon: Users },
  { key: "adresses", label: "Adresses", icon: MapPin },
  { key: "commandes", label: "Commandes", icon: Package },
  { key: "reclamations", label: "Reclamations", icon: AlertCircle },
  { key: "suivi", label: "Liste de suivi", icon: Heart },
  { key: "portefeuille", label: "Portefeuille", icon: Zap },
  { key: "catalogue", label: "Catalogue", icon: Download },
  { key: "bnpl", label: "Payer plus tard", icon: Layers },
];

const orders = [
  { id: "MK-2026-00847", date: "25/03/2026", status: "Livree", articles: 5, montant: 234.50 },
  { id: "MK-2026-00812", date: "18/03/2026", status: "Confirmee", articles: 3, montant: 89.90 },
  { id: "MK-2026-00798", date: "10/03/2026", status: "Expediee", articles: 8, montant: 456.00 },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("profil");

  return (
    <Layout>
      <div className="bg-mk-alt border-b border-mk-line py-6">
        <div className="mk-container">
          <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Mon compte</h1>
          <p className="text-sm text-mk-sec">Gerez votre profil, commandes et preferences</p>
        </div>
      </div>
      <div className="mk-container py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar - horizontal scroll on mobile */}
          <aside className="md:w-[220px] shrink-0 md:border-r border-mk-line md:pr-6">
            <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                    activeTab === t.key ? "bg-mk-blue text-white font-medium" : "text-mk-sec hover:bg-mk-alt"
                  }`}
                >
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 animate-fadeIn">
            {activeTab === "profil" && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Informations personnelles</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {[["Prenom", "Jean"], ["Nom", "Dupont"], ["Email", "jean@pharmacie.be"], ["Telephone", "+32 478 12 34 56"]].map(([l, v]) => (
                    <div key={l}><label className="text-xs text-mk-sec mb-1 block">{l}</label><input defaultValue={v} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                  ))}
                </div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Informations entreprise</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div><label className="text-xs text-mk-sec mb-1 block">Nom entreprise</label><input defaultValue="Pharmacie Centrale" className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-mk-sec mb-1 block">Pays</label>
                    <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm"><option>Belgique</option><option>France</option><option>Suisse</option></select>
                  </div>
                  <div><label className="text-xs text-mk-sec mb-1 block">Numero TVA</label><input defaultValue="BE 0123.456.789" className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                </div>
                <button className="bg-mk-blue text-white font-semibold text-sm px-5 py-2.5 rounded-md">Enregistrer les modifications</button>
              </div>
            )}

            {activeTab === "adresses" && (
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                  <h2 className="text-xl font-bold text-mk-navy">Adresses</h2>
                  <button className="bg-mk-blue text-white text-sm px-4 py-2 rounded-md">Ajouter une adresse</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Adresse principale", type: "Livraison", addr: "23 rue de la Procession\nB-7822 Ath, Belgique" },
                    { label: "Siege social", type: "Facturation", addr: "15 avenue Louise\nB-1050 Bruxelles, Belgique" },
                  ].map(a => (
                    <div key={a.label} className="border border-mk-line rounded-lg p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-mk-navy">{a.label}</span>
                        <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded">{a.type}</span>
                      </div>
                      <p className="text-sm text-mk-sec whitespace-pre-line mb-3">{a.addr}</p>
                      <div className="flex gap-2">
                        <button className="text-xs text-mk-blue">Modifier</button>
                        <button className="text-xs text-mk-red">Supprimer</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "commandes" && (
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                  <h2 className="text-xl font-bold text-mk-navy">Commandes</h2>
                  <select className="border border-mk-line rounded-md px-3 py-1.5 text-sm">
                    <option>Toutes</option><option>Confirmee</option><option>Expediee</option><option>Livree</option><option>Annulee</option>
                  </select>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {orders.map(o => (
                    <Link key={o.id} to={`/commande/${o.id}`} className="block border border-mk-line rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-mk-navy text-sm">{o.id}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          o.status === "Livree" ? "bg-mk-deal text-mk-green" :
                          o.status === "Confirmee" ? "bg-blue-50 text-mk-blue" :
                          "bg-mk-mov-bg text-mk-amber"
                        }`}>{o.status}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-mk-sec">{o.date} · {o.articles} articles</span>
                        <span className="font-bold text-mk-navy">{formatPrice(o.montant)} EUR</span>
                      </div>
                    </Link>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block border border-mk-line rounded-lg overflow-hidden">
                  <div className="grid grid-cols-5 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec">
                    <span>ID Commande</span><span>Date</span><span>Statut</span><span>Articles</span><span>Montant</span>
                  </div>
                  {orders.map(o => (
                    <Link key={o.id} to={`/commande/${o.id}`} className="grid grid-cols-5 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center hover:bg-mk-alt">
                      <span className="font-medium text-mk-navy">{o.id}</span>
                      <span className="text-mk-sec">{o.date}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded w-fit ${
                        o.status === "Livree" ? "bg-mk-deal text-mk-green" :
                        o.status === "Confirmee" ? "bg-blue-50 text-mk-blue" :
                        "bg-mk-mov-bg text-mk-amber"
                      }`}>{o.status}</span>
                      <span className="text-mk-sec">{o.articles}</span>
                      <span className="font-bold text-mk-navy">{formatPrice(o.montant)} EUR</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "reclamations" && (
              <div className="text-center py-16">
                <AlertCircle size={40} className="mx-auto text-mk-ter mb-3" />
                <h3 className="text-lg font-bold text-mk-navy mb-1">Aucune reclamation</h3>
                <p className="text-sm text-mk-sec">Vos reclamations apparaitront ici</p>
              </div>
            )}

            {activeTab === "suivi" && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Liste de suivi</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.slice(0, 4).map((p, i) => (
                    <div key={p.id} className="border border-mk-line rounded-lg p-4 relative">
                      <button className="absolute top-3 right-3"><Heart size={16} fill="#EF4343" className="text-mk-red" /></button>
                      <div className="aspect-square bg-mk-alt rounded-lg mb-3 flex items-center justify-center text-xs text-mk-ter">IMG</div>
                      <p className="text-xs text-mk-sec">{p.brand}</p>
                      <p className="text-sm font-medium text-mk-text mb-2 truncate">{p.name}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-mk-navy">{formatPrice(p.price)} EUR</span>
                        <span className="text-xs text-mk-green">{p.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "portefeuille" && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Portefeuille</h2>
                <div className="text-center py-8">
                  <div className="text-4xl md:text-5xl font-bold text-mk-navy mb-4">0,00 EUR</div>
                  <div className="flex justify-center gap-3">
                    <button className="bg-mk-blue text-white text-sm px-5 py-2 rounded-md">Recharger</button>
                    <button className="border border-mk-line text-sm px-5 py-2 rounded-md text-mk-sec">Retirer</button>
                  </div>
                </div>
                <div className="bg-mk-mov-bg border border-mk-mov-border rounded-lg p-5 mt-6">
                  <h3 className="text-sm font-bold text-mk-navy mb-2">Comment utiliser votre portefeuille ?</h3>
                  <ul className="text-sm text-mk-sec space-y-1">
                    <li>Rechargez via virement ou carte bancaire</li>
                    <li>Payez vos commandes instantanement</li>
                    <li>Beneficiez de remises supplementaires</li>
                    <li>Retirez votre solde a tout moment</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "catalogue" && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Catalogue</h2>
                <div className="flex gap-3 mb-6">
                  <button className="flex-1 border-2 border-mk-blue rounded-lg p-4 text-center"><Mail size={20} className="mx-auto mb-1 text-mk-blue" /><span className="text-sm font-medium text-mk-navy">Par Email</span></button>
                  <button className="flex-1 border border-mk-line rounded-lg p-4 text-center text-mk-sec"><Download size={20} className="mx-auto mb-1" /><span className="text-sm font-medium">Par API</span></button>
                </div>
                <div className="space-y-4">
                  <div><label className="text-xs text-mk-sec mb-1 block">Email</label><input placeholder="votre@email.com" className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs text-mk-sec mb-1 block">Langue</label>
                    <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm"><option>Francais</option><option>English</option><option>Nederlands</option></select>
                  </div>
                  <button className="bg-mk-blue text-white text-sm font-semibold px-5 py-2.5 rounded-md">Envoyer le catalogue</button>
                </div>
              </div>
            )}

            {activeTab === "bnpl" && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Payer plus tard</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-mk-navy mb-3">Conditions</h3>
                    <ul className="text-sm text-mk-sec space-y-2">
                      <li>Paiement en 2, 3 ou 4 versements</li>
                      <li>Sans frais supplementaires</li>
                      <li>Montant minimum: 100 EUR</li>
                      <li>Verification instantanee</li>
                      <li>Livraison avant le premier paiement</li>
                    </ul>
                  </div>
                  <div className="bg-mk-deal rounded-lg p-5">
                    <h3 className="text-sm font-bold text-mk-navy mb-3">Avantages</h3>
                    {["Tresorerie preservee", "Process 100% digital", "Aucun frais cache", "Compatible toutes commandes", "Support dedie"].map(a => (
                      <div key={a} className="flex items-center gap-2 text-sm text-mk-green mb-2">
                        <span className="w-4 h-4 rounded-full bg-mk-green/20 flex items-center justify-center"><span className="text-xs">✓</span></span> {a}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  {["Aujourd'hui", "1 mois", "2 mois", "3 mois"].map(p => (
                    <div key={p} className="bg-mk-mov-bg border border-mk-mov-border rounded-lg p-4 text-center">
                      <div className="text-xs text-mk-sec mb-1">{p}</div>
                      <div className="text-lg font-bold text-mk-navy">250,00 EUR</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
