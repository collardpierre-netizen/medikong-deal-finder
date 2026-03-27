import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { sellerPortfolios } from "@/data/mock";
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin,
  DollarSign, ShoppingCart, Star, TrendingUp, Percent,
  RotateCcw, Package, Award, Shield, Users, FileText,
  MessageSquare, StickyNote, Activity, CheckCircle2,
  Clock, AlertTriangle, Download, Upload, Tag, Factory,
} from "lucide-react";

// Mock seller data
const sellerData: Record<string, any> = {
  "1": {
    company: "Valerco", legalForm: "NV", status: "active", tier: "Gold",
    legal: {
      name: "Valerco NV", form: "Naamloze Vennootschap", vat: "BE 0456.789.123", bce: "0456.789.123",
      iban: "BE68 5390 0754 7034", afmps: "AFMPS-GR-2023-4521", rcInsurance: "AXA Belgium — Police RC-2024-78452",
    },
    contact: { name: "Thomas Verhoeven", email: "t.verhoeven@valerco.be", phone: "+32 3 450 78 90", role: "Directeur commercial" },
    address: { street: "Industriepark Noord 42", city: "Kontich", zip: "2550", country: "Belgique" },
    profile: { displayName: "Valerco Medical", tagline: "Votre partenaire en fournitures médicales depuis 2008", about: "Distributeur spécialisé en dispositifs médicaux et consommables pour le secteur hospitalier et les cabinets médicaux en Belgique et au Luxembourg." },
    kpis: { gmv: 38900, orders: 124, commission: 3308, avgBasket: 313, returnRate: 1.2, rating: 4.9, fulfillment: 98.5 },
    admin: { status: "active", tier: "Gold", commissionRate: 8.5, riskLevel: "low", internalScore: 92 },
  },
  "2": {
    company: "Pharmamed", legalForm: "SRL", status: "active", tier: "Platinum",
    legal: {
      name: "Pharmamed SRL", form: "Société à Responsabilité Limitée", vat: "BE 0789.456.321", bce: "0789.456.321",
      iban: "BE42 3100 1234 5678", afmps: "AFMPS-GR-2022-3187", rcInsurance: "Ethias — Police RC-2024-31245",
    },
    contact: { name: "Isabelle Lecomte", email: "i.lecomte@pharmamed.be", phone: "+32 2 345 67 89", role: "CEO" },
    address: { street: "Avenue Louise 231", city: "Bruxelles", zip: "1050", country: "Belgique" },
    profile: { displayName: "Pharmamed Belgium", tagline: "Solutions pharmaceutiques OTC de confiance", about: "Leader belge en distribution de médicaments OTC et parapharmacie." },
    kpis: { gmv: 45200, orders: 189, commission: 3254, avgBasket: 239, returnRate: 0.8, rating: 4.8, fulfillment: 99.2 },
    admin: { status: "active", tier: "Platinum", commissionRate: 7.2, riskLevel: "low", internalScore: 96 },
  },
};

// Fallback for IDs not in sellerData
const getSellerData = (id: string) => sellerData[id] || sellerData["1"];

const teamMembers = [
  { name: "Thomas Verhoeven", role: "Directeur commercial", langs: ["FR", "NL", "EN"], brands: ["Hartmann", "Mölnlycke"], available: true },
  { name: "Lies Peeters", role: "Account Manager", langs: ["NL", "EN"], brands: ["3M", "Coloplast"], available: true },
  { name: "François Dubois", role: "Logistique", langs: ["FR"], brands: [], available: false },
  { name: "Sara Van den Berg", role: "Support client", langs: ["NL", "FR", "DE"], brands: [], available: true },
];

const documents = [
  { name: "Extrait BCE", file: "extrait_bce_valerco.pdf", status: "verified", date: "15/01/2025" },
  { name: "Licence AFMPS", file: "licence_afmps_2023.pdf", status: "verified", date: "20/01/2025" },
  { name: "Assurance RC Pro", file: "assurance_rc_axa.pdf", status: "verified", date: "18/01/2025" },
  { name: "Certificat TVA", file: "cert_tva_be.pdf", status: "verified", date: "15/01/2025" },
  { name: "Contrat vendeur", file: "contrat_medikong_v2.pdf", status: "pending", date: "01/03/2025" },
  { name: "RIB / Coordonnées bancaires", file: "rib_bnp.pdf", status: "verified", date: "15/01/2025" },
];

const activityLog = [
  { action: "Commande MK-2025-04821 livrée", time: "Il y a 2h", type: "order" },
  { action: "Mise à jour prix — 12 offres modifiées", time: "Il y a 5h", type: "price" },
  { action: "Nouveau produit ajouté — Gants Nitrile M", time: "Il y a 1j", type: "product" },
  { action: "Document 'Contrat vendeur v2' uploadé", time: "Il y a 2j", type: "doc" },
  { action: "Rating acheteur reçu — 5/5 ★", time: "Il y a 3j", type: "rating" },
  { action: "Ticket support #TS-456 résolu", time: "Il y a 5j", type: "support" },
];

const notes = [
  { author: "Admin — Julie M.", date: "26/03/2025", text: "Vendeur fiable, bon historique. Envisager upgrade Platinum au prochain trimestre." },
  { author: "Compliance — Thomas B.", date: "15/03/2025", text: "Tous les documents à jour. Licence AFMPS renouvelée jusqu'en 2026." },
  { author: "Commercial — Sophie L.", date: "01/03/2025", text: "Nouveau contrat v2 envoyé, en attente de signature." },
];

const tabList = [
  { key: "resume", label: "Résumé", icon: Building2 },
  { key: "portfolio", label: "Portefeuille", icon: Tag },
  { key: "products", label: "Produits", icon: Package },
  { key: "orders", label: "Commandes", icon: ShoppingCart },
  { key: "disputes", label: "Litiges", icon: AlertTriangle },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "team", label: "Équipe", icon: Users },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "activity", label: "Activité", icon: Activity },
];

const riskColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "#F0FDF4", text: "#059669" },
  medium: { bg: "#FFFBEB", text: "#D97706" },
  high: { bg: "#FEF2F2", text: "#EF4343" },
};
const tierColors: Record<string, { bg: string; text: string }> = {
  Bronze: { bg: "#FEF3C7", text: "#92400E" },
  Silver: { bg: "#F1F5F9", text: "#475569" },
  Gold: { bg: "#FEF9C3", text: "#A16207" },
  Platinum: { bg: "#EDE9FE", text: "#7C3AED" },
  Strategic: { bg: "#FCE7F3", text: "#BE185D" },
};

const AdminVendeurDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("resume");
  const seller = getSellerData(id || "1");

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
      <span className="w-[180px] shrink-0 text-[12px] font-medium" style={{ color: "#8B95A5" }}>{label}</span>
      <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{value}</span>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/admin/vendeurs")}
          className="w-9 h-9 flex items-center justify-center rounded-md"
          style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}
        >
          <ArrowLeft size={16} style={{ color: "#616B7C" }} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold" style={{ color: "#1D2530" }}>{seller.company}</h1>
            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>
              {seller.legalForm}
            </span>
            <StatusBadge status={seller.admin.status} />
            <span
              className="px-2 py-1 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: tierColors[seller.admin.tier].bg, color: tierColors[seller.admin.tier].text }}
            >
              {seller.admin.tier}
            </span>
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>
            {seller.contact.name} · {seller.contact.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-md text-[12px] font-semibold" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>
            Suspendre
          </button>
          <button className="px-4 py-2 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#1E293B" }}>
            Modifier
          </button>
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

      {/* Tab Content */}
      {activeTab === "resume" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard icon={DollarSign} label="GMV mois" value={`€${seller.kpis.gmv.toLocaleString()}`} evolution={{ value: 18.3, label: "vs mois dernier" }} />
            <KpiCard icon={ShoppingCart} label="Commandes" value={String(seller.kpis.orders)} iconColor="#7C3AED" iconBg="#F5F3FF" />
            <KpiCard icon={Star} label="Rating" value={String(seller.kpis.rating)} iconColor="#F59E0B" iconBg="#FFFBEB" />
            <KpiCard icon={Package} label="Fulfillment" value={`${seller.kpis.fulfillment}%`} iconColor="#059669" iconBg="#F0FDF4" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Identité légale */}
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                <Building2 size={16} /> Identité légale
              </h3>
              <InfoRow label="Raison sociale" value={seller.legal.name} />
              <InfoRow label="Forme juridique" value={seller.legal.form} />
              <InfoRow label="N° TVA" value={seller.legal.vat} />
              <InfoRow label="N° BCE" value={seller.legal.bce} />
              <InfoRow label="IBAN" value={seller.legal.iban} />
              <InfoRow label="Licence AFMPS" value={seller.legal.afmps} />
              <InfoRow label="Assurance RC" value={seller.legal.rcInsurance} />
            </div>

            {/* Contact & Adresse */}
            <div className="space-y-4">
              <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                  <Mail size={16} /> Contact principal
                </h3>
                <InfoRow label="Nom" value={seller.contact.name} />
                <InfoRow label="Fonction" value={seller.contact.role} />
                <InfoRow label="Email" value={seller.contact.email} />
                <InfoRow label="Téléphone" value={seller.contact.phone} />
              </div>
              <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                  <MapPin size={16} /> Adresse
                </h3>
                <InfoRow label="Rue" value={seller.address.street} />
                <InfoRow label="Ville" value={`${seller.address.zip} ${seller.address.city}`} />
                <InfoRow label="Pays" value={seller.address.country} />
              </div>
            </div>

            {/* Profil public */}
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                <Globe size={16} /> Profil public
              </h3>
              <InfoRow label="Display name" value={seller.profile.displayName} />
              <InfoRow label="Tagline" value={seller.profile.tagline} />
              <div className="mt-2">
                <span className="text-[12px] font-medium" style={{ color: "#8B95A5" }}>About</span>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#616B7C" }}>{seller.profile.about}</p>
              </div>
            </div>

            {/* Paramètres admin */}
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                <Shield size={16} /> Paramètres admin
              </h3>
              <InfoRow label="Statut" value={seller.admin.status} />
              <div className="flex items-start py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                <span className="w-[180px] shrink-0 text-[12px] font-medium" style={{ color: "#8B95A5" }}>Tier</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: tierColors[seller.admin.tier].bg, color: tierColors[seller.admin.tier].text }}
                >
                  {seller.admin.tier}
                </span>
              </div>
              <InfoRow label="Taux commission" value={`${seller.admin.commissionRate}%`} />
              <div className="flex items-start py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                <span className="w-[180px] shrink-0 text-[12px] font-medium" style={{ color: "#8B95A5" }}>Risk level</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: riskColors[seller.admin.riskLevel].bg, color: riskColors[seller.admin.riskLevel].text }}
                >
                  {seller.admin.riskLevel.toUpperCase()}
                </span>
              </div>
              <InfoRow label="Score interne" value={`${seller.admin.internalScore}/100`} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "portfolio" && (() => {
        const portfolio = sellerPortfolios[seller.company] || { brands: [], manufacturers: [] };
        return (
          <div className="space-y-4">
            {/* Brands */}
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: "#1D2530" }}>
                <Tag size={16} style={{ color: "#1B5BDA" }} /> Marques en portefeuille ({portfolio.brands.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {portfolio.brands.map((b) => (
                  <span key={b} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA", border: "1px solid #DBEAFE" }}>
                    {b}
                  </span>
                ))}
                {portfolio.brands.length === 0 && <span className="text-[12px]" style={{ color: "#8B95A5" }}>Aucune marque enregistrée</span>}
              </div>
            </div>

            {/* Manufacturers */}
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: "#1D2530" }}>
                <Factory size={16} style={{ color: "#7C3AED" }} /> Fabricants ({portfolio.manufacturers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {portfolio.manufacturers.map((m) => (
                  <span key={m} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "#F3F0FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}>
                    {m}
                  </span>
                ))}
                {portfolio.manufacturers.length === 0 && <span className="text-[12px]" style={{ color: "#8B95A5" }}>Aucun fabricant enregistré</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === "team" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Membre", "Rôle", "Langues", "Marques assignées", "Disponible"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((m) => (
                <tr key={m.name} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1D2530" }}>{m.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{m.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {m.langs.map((l) => (
                        <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>
                    {m.brands.length > 0 ? m.brands.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: m.available ? "#059669" : "#EF4343" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Document", "Fichier", "Statut", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.name} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: "#1D2530" }}>{d.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] flex items-center gap-1" style={{ color: "#1B5BDA" }}>
                      <FileText size={13} /> {d.file}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status === "verified" ? "active" : "pending"} label={d.status === "verified" ? "Vérifié" : "En attente"} />
                  </td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{d.date}</td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded hover:bg-gray-100">
                      <Download size={14} style={{ color: "#616B7C" }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="space-y-3">
          {notes.map((n, i) => (
            <div key={i} className="p-4 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold" style={{ color: "#1B5BDA" }}>{n.author}</span>
                <span className="text-[11px]" style={{ color: "#8B95A5" }}>{n.date}</span>
              </div>
              <p className="text-[13px]" style={{ color: "#1D2530" }}>{n.text}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <div className="space-y-0">
            {activityLog.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-3" style={{ borderBottom: i < activityLog.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#1B5BDA" }} />
                <div className="flex-1">
                  <span className="text-[13px]" style={{ color: "#1D2530" }}>{a.action}</span>
                </div>
                <span className="text-[11px] shrink-0" style={{ color: "#8B95A5" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {["products", "orders", "disputes", "messages"].includes(activeTab) && (
        <div className="py-16 text-center rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <p className="text-[14px] font-medium" style={{ color: "#8B95A5" }}>
            Section "{tabList.find((t) => t.key === activeTab)?.label}" — bientôt disponible
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminVendeurDetail;
