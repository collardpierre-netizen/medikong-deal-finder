import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import {
  ArrowLeft, ShoppingCart, ExternalLink, TrendingUp, Globe,
  Package, FileText, Activity, Shield, BarChart3, Star,
  CheckCircle2, AlertTriangle, Clock, Layers,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";

const productMap: Record<string, any> = {
  "1": {
    name: "Gants Nitrile Aurelia Bold — Boîte de 200", cnk: "12450", ean: "5425038720082", gtin: "05425038720082",
    atc: "V07AB", cip: "34009 123 456 7 8", brand: "Aurelia", manufacturer: "Supermax Healthcare",
    category: { l1: "Médical", l2: "Soins & Hygiène", l3: "Gants" },
    status: "active", image: "🧤",
    kpis: { directOffers: 8, indirectOffers: 3, marketSources: 5 },
    compliance: { mdrClass: "Classe I", ce: true, ceMark: "CE 0123", afmps: "Notifié", lotTracing: true },
  },
  "2": {
    name: "Sekusept Aktiv Désinfectant — 6 kg", cnk: "10480", ean: "4031678053568", gtin: "04031678053568",
    atc: "D08A", cip: "—", brand: "Ecolab", manufacturer: "Ecolab Deutschland GmbH",
    category: { l1: "Médical", l2: "Désinfection", l3: "Surfaces" },
    status: "active", image: "🧪",
    kpis: { directOffers: 5, indirectOffers: 2, marketSources: 4 },
    compliance: { mdrClass: "Biocide TP2", ce: false, ceMark: "—", afmps: "Notifié", lotTracing: true },
  },
};

const getProduct = (id: string) => productMap[id] || productMap["1"];

const directOffers = [
  { seller: "Valerco NV", priceHT: 12.90, priceTTC: 15.61, stock: 5000, moq: 10, mov: 100, delivery: "24-48h", commission: 8.5, buyBox: true, fulfillment: 98.5 },
  { seller: "Pharmamed SRL", priceHT: 13.20, priceTTC: 15.97, stock: 3200, moq: 5, mov: 50, delivery: "48h", commission: 7.2, buyBox: false, fulfillment: 99.2 },
  { seller: "MedDistri SA", priceHT: 13.50, priceTTC: 16.34, stock: 2800, moq: 20, mov: 200, delivery: "3-5j", commission: 9.0, buyBox: false, fulfillment: 95.8 },
];

const indirectOffers = [
  { seller: "MedShop.be", url: "medshop.be/gants-aurelia", price: 14.90, model: "CPA", clicks30: 245, conv30: 12, revenue: 58.80 },
  { seller: "Pharmamarket.be", url: "pharmamarket.be/aurelia-bold", price: 15.20, model: "CPC", clicks30: 189, conv30: 8, revenue: 37.80 },
  { seller: "DocMorris.be", url: "docmorris.be/gants-nitrile", price: 14.50, model: "CPA", clicks30: 312, conv30: 18, revenue: 86.40 },
];

const marketSources = [
  { source: "Amazon.de", price: 13.80, method: "Scraping", confidence: 92, lastChange: "Il y a 2h" },
  { source: "Mediq.be", price: 14.20, method: "API", confidence: 99, lastChange: "Il y a 30min" },
  { source: "Henry Schein", price: 13.50, method: "Scraping", confidence: 85, lastChange: "Il y a 1j" },
  { source: "Multipharma", price: 15.90, method: "Scraping", confidence: 78, lastChange: "Il y a 3j" },
  { source: "Onemed.be", price: 12.60, method: "API", confidence: 97, lastChange: "Il y a 4h" },
];

const priceHistory = [
  { month: "Oct", direct: 13.80, indirect: 15.20, market: 14.10 },
  { month: "Nov", direct: 13.50, indirect: 14.90, market: 13.90 },
  { month: "Déc", direct: 13.20, indirect: 14.80, market: 13.60 },
  { month: "Jan", direct: 12.90, indirect: 14.50, market: 13.40 },
  { month: "Fév", direct: 12.90, indirect: 14.90, market: 13.80 },
  { month: "Mar", direct: 12.90, indirect: 14.90, market: 13.50 },
];

const pimAttributes = [
  { attr: "Nb pièces par boîte", global: "—", parent: "—", subcat: "200", product: "200", resolved: "200", level: "subcat" },
  { attr: "Matériau", global: "—", parent: "—", subcat: "Nitrile", product: "—", resolved: "Nitrile", level: "subcat" },
  { attr: "Sans latex", global: "true", parent: "—", subcat: "—", product: "—", resolved: "true", level: "global" },
  { attr: "Stérile", global: "false", parent: "—", subcat: "—", product: "—", resolved: "false", level: "global" },
  { attr: "Taille", global: "—", parent: "—", subcat: "—", product: "M", resolved: "M", level: "product" },
  { attr: "Couleur", global: "—", parent: "—", subcat: "Bleu", product: "—", resolved: "Bleu", level: "subcat" },
  { attr: "Poudré", global: "—", parent: "Non poudré", subcat: "—", product: "—", resolved: "Non poudré", level: "parent" },
  { attr: "Épaisseur (mil)", global: "—", parent: "—", subcat: "—", product: "4.7", resolved: "4.7", level: "product" },
];

const historyTimeline = [
  { action: "Prix mis à jour par Valerco — €13.20 → €12.90", date: "15/03/2025", user: "Auto" },
  { action: "Nouvelle offre ajoutée — MedDistri SA", date: "10/03/2025", user: "Sophie L." },
  { action: "Image principale mise à jour", date: "28/02/2025", user: "Admin" },
  { action: "Catégorie modifiée — Consommables → Gants", date: "15/02/2025", user: "PIM Bot" },
  { action: "Produit créé dans le catalogue", date: "01/02/2025", user: "Import CSV" },
];

const levelColors: Record<string, { bg: string; text: string }> = {
  global: { bg: "#EDE9FE", text: "#7C3AED" },
  parent: { bg: "#EFF6FF", text: "#1B5BDA" },
  subcat: { bg: "#F0FDF4", text: "#059669" },
  product: { bg: "#FEF9C3", text: "#A16207" },
};

const tabList = [
  { key: "resume", label: "Résumé", icon: Package },
  { key: "offers", label: "Offres", icon: ShoppingCart },
  { key: "price", label: "Prix", icon: BarChart3 },
  { key: "attributes", label: "Attributs", icon: Layers },
  { key: "history", label: "Historique", icon: Activity },
  { key: "compliance", label: "Compliance", icon: Shield },
];

const AdminProduitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("resume");
  const [offerSubTab, setOfferSubTab] = useState<"direct" | "indirect" | "market">("direct");
  const product = getProduct(id || "1");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/admin/produits")} className="w-9 h-9 flex items-center justify-center rounded-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <ArrowLeft size={16} style={{ color: "#616B7C" }} />
        </button>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: "#F1F5F9" }}>
          {product.image}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold" style={{ color: "#1D2530" }}>{product.name}</h1>
            <StatusBadge status={product.status} />
          </div>
          <p className="text-[12px]" style={{ color: "#8B95A5" }}>
            {product.brand} · CNK {product.cnk} · EAN {product.ean}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-5 overflow-x-auto pb-1" style={{ borderBottom: "1px solid #E2E8F0" }}>
        {tabList.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors"
            style={{
              color: activeTab === tab.key ? "#1B5BDA" : "#8B95A5",
              borderBottom: activeTab === tab.key ? "2px solid #1B5BDA" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Résumé */}
      {activeTab === "resume" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <KpiCard icon={ShoppingCart} label="Offres directes" value={String(product.kpis.directOffers)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
            <KpiCard icon={ExternalLink} label="Offres indirectes" value={String(product.kpis.indirectOffers)} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Globe} label="Sources marché" value={String(product.kpis.marketSources)} iconColor="#059669" iconBg="#F0FDF4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Identifiants</h3>
              {[
                ["CNK", product.cnk], ["EAN", product.ean], ["GTIN-14", product.gtin],
                ["ATC", product.atc], ["CIP", product.cip],
              ].map(([label, val]) => (
                <div key={label} className="flex py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <span className="w-24 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
                  <span className="text-[13px] font-mono" style={{ color: "#1D2530" }}>{val}</span>
                </div>
              ))}
            </div>
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Classification</h3>
              {[
                ["Marque", product.brand], ["Fabricant", product.manufacturer],
                ["Catégorie L1", product.category.l1], ["Catégorie L2", product.category.l2], ["Catégorie L3", product.category.l3],
              ].map(([label, val]) => (
                <div key={label} className="flex py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <span className="w-28 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
                  <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Offres */}
      {activeTab === "offers" && (
        <div>
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
            {[
              { key: "direct" as const, label: "Directes (marketplace)", count: directOffers.length },
              { key: "indirect" as const, label: "Indirectes (affiliation)", count: indirectOffers.length },
              { key: "market" as const, label: "Marché (veille)", count: marketSources.length },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setOfferSubTab(st.key)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-semibold transition-colors"
                style={{ backgroundColor: offerSubTab === st.key ? "#1B5BDA" : "transparent", color: offerSubTab === st.key ? "#fff" : "#616B7C" }}
              >
                {st.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: offerSubTab === st.key ? "rgba(255,255,255,0.2)" : "#F1F5F9", color: offerSubTab === st.key ? "#fff" : "#8B95A5" }}>
                  {st.count}
                </span>
              </button>
            ))}
          </div>

          {offerSubTab === "direct" && (
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["Vendeur", "Prix HT", "Prix TTC", "Stock", "MOQ", "MOV", "Délai", "Commission", "Buy Box", "Fulfillment"].map((h) => (
                      <th key={h} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {directOffers.map((o, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: "#1B5BDA" }}>{o.seller}</td>
                      <td className="px-3 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{o.priceHT.toFixed(2)}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>€{o.priceTTC.toFixed(2)}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.stock.toLocaleString()}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.moq}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>€{o.mov}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.delivery}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.commission}%</td>
                      <td className="px-3 py-3">
                        {o.buyBox ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#F0FDF4", color: "#059669" }}>★ Buy Box</span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "#8B95A5" }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[12px] font-medium" style={{ color: o.fulfillment >= 98 ? "#059669" : "#F59E0B" }}>{o.fulfillment}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {offerSubTab === "indirect" && (
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["Vendeur externe", "URL", "Prix", "Modèle", "Clicks 30j", "Conv. 30j", "Revenu lead"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {indirectOffers.map((o, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1D2530" }}>{o.seller}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#1B5BDA" }}>{o.url}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{o.price.toFixed(2)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}>{o.model}</span></td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.clicks30}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.conv30}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#059669" }}>€{o.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {offerSubTab === "market" && (
            <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    {["Source", "Prix", "Méthode", "Match confidence", "Dernier changement"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marketSources.map((s, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1D2530" }}>{s.source}</td>
                      <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{s.price.toFixed(2)}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: s.method === "API" ? "#F0FDF4" : "#FFFBEB", color: s.method === "API" ? "#059669" : "#D97706" }}>{s.method}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full" style={{ backgroundColor: "#F1F5F9" }}>
                            <div className="h-2 rounded-full" style={{ width: `${s.confidence}%`, backgroundColor: s.confidence >= 90 ? "#059669" : s.confidence >= 80 ? "#F59E0B" : "#EF4343" }} />
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: "#1D2530" }}>{s.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{s.lastChange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prix */}
      {activeTab === "price" && (
        <div className="space-y-4">
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Évolution des prix — 6 mois</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(v: number) => [`€${v.toFixed(2)}`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="direct" name="Direct" stroke="#1B5BDA" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="indirect" name="Indirect" stroke="#7C3AED" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="market" name="Marché" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-3" style={{ color: "#1D2530" }}>Gap Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Direct vs Marché", gap: -4.4, desc: "Notre meilleur prix est 4.4% en dessous du marché" },
                { label: "Direct vs Indirect", gap: -13.4, desc: "Écart de 13.4% par rapport aux affiliés" },
                { label: "Indirect vs Marché", gap: +10.4, desc: "Les affiliés sont 10.4% au-dessus du marché" },
              ].map((g) => (
                <div key={g.label} className="p-4 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <span className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>{g.label}</span>
                  <p className="text-[20px] font-bold mt-1" style={{ color: g.gap < 0 ? "#059669" : "#EF4343" }}>
                    {g.gap > 0 ? "+" : ""}{g.gap}%
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "#616B7C" }}>{g.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Attributs PIM */}
      {activeTab === "attributes" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
            <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>Héritage PIM — Résolution</span>
            <div className="flex gap-2 ml-auto">
              {[
                { label: "Global", color: levelColors.global },
                { label: "Parent", color: levelColors.parent },
                { label: "Sous-catégorie", color: levelColors.subcat },
                { label: "Produit", color: levelColors.product },
              ].map((l) => (
                <span key={l.label} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: l.color.bg, color: l.color.text }}>
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Attribut", "L0 Global", "L1 Parent", "L2 Sous-cat", "L3 Produit", "Résolu"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pimAttributes.map((a) => (
                <tr key={a.attr} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{a.attr}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: a.global !== "—" ? levelColors.global.text : "#D4D9E1" }}>{a.global}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: a.parent !== "—" ? levelColors.parent.text : "#D4D9E1" }}>{a.parent}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: a.subcat !== "—" ? levelColors.subcat.text : "#D4D9E1" }}>{a.subcat}</td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: a.product !== "—" ? levelColors.product.text : "#D4D9E1" }}>{a.product}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: levelColors[a.level].bg, color: levelColors[a.level].text }}>
                      {a.resolved}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Historique */}
      {activeTab === "history" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          {historyTimeline.map((h, i) => (
            <div key={i} className="flex items-start gap-3 py-3" style={{ borderBottom: i < historyTimeline.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#1B5BDA" }} />
              <div className="flex-1">
                <span className="text-[13px]" style={{ color: "#1D2530" }}>{h.action}</span>
                <span className="text-[11px] ml-2" style={{ color: "#8B95A5" }}>par {h.user}</span>
              </div>
              <span className="text-[11px] shrink-0" style={{ color: "#8B95A5" }}>{h.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compliance */}
      {activeTab === "compliance" && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Classe MDR", value: product.compliance.mdrClass, ok: true },
            { label: "Marquage CE", value: product.compliance.ceMark, ok: product.compliance.ce },
            { label: "AFMPS", value: product.compliance.afmps, ok: true },
            { label: "Traçabilité lots", value: product.compliance.lotTracing ? "Actif" : "Non configuré", ok: product.compliance.lotTracing },
          ].map((c) => (
            <div key={c.label} className="p-5 rounded-[10px] flex items-start gap-4" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.ok ? "#F0FDF4" : "#FEF2F2" }}>
                {c.ok ? <CheckCircle2 size={20} style={{ color: "#059669" }} /> : <AlertTriangle size={20} style={{ color: "#EF4343" }} />}
              </div>
              <div>
                <span className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>{c.label}</span>
                <p className="text-[15px] font-bold mt-0.5" style={{ color: "#1D2530" }}>{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminProduitDetail;
