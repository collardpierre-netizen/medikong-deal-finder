import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { Package, Tag, ShoppingCart, AlertTriangle, Search, Filter, Download, Plus, ExternalLink } from "lucide-react";

interface Product {
  id: string;
  name: string;
  cnk: string;
  ean: string;
  brand: string;
  nbOffers: number;
  bestPrice: number;
  stockTotal: number;
  status: "active" | "pending" | "archived";
  image: string;
  category: string;
}

const products: Product[] = [
  { id: "1", name: "Gants Nitrile Aurelia Bold — Boîte de 200", cnk: "12450", ean: "5425038720082", brand: "Aurelia", nbOffers: 8, bestPrice: 12.90, stockTotal: 14500, status: "active", image: "🧤", category: "Gants" },
  { id: "2", name: "Sekusept Aktiv Désinfectant — 6 kg", cnk: "10480", ean: "4031678053568", brand: "Ecolab", nbOffers: 5, bestPrice: 33.59, stockTotal: 890, status: "active", image: "🧪", category: "Désinfection" },
  { id: "3", name: "Masques FFP2 Kolmi — Boîte de 50", cnk: "15230", ean: "3700256203145", brand: "Kolmi", nbOffers: 12, bestPrice: 18.50, stockTotal: 32000, status: "active", image: "😷", category: "Masques" },
  { id: "4", name: "Compresses Stériles 10x10 — Boîte de 100", cnk: "11890", ean: "4049500361002", brand: "Hartmann", nbOffers: 3, bestPrice: 4.20, stockTotal: 8700, status: "pending", image: "🩹", category: "Compresses" },
  { id: "5", name: "Betadine Scrub 4% — 500 ml", cnk: "13670", ean: "5400951001827", brand: "Meda Pharma", nbOffers: 6, bestPrice: 8.75, stockTotal: 2300, status: "active", image: "💊", category: "Cutanés" },
  { id: "6", name: "TENA Discreet Normal — x12", cnk: "4107876", ean: "7322540523539", brand: "TENA", nbOffers: 4, bestPrice: 4.03, stockTotal: 18200, status: "active", image: "🏥", category: "Incontinence" },
];

interface Offer {
  id: string;
  product: string;
  seller: string;
  priceHT: number;
  stock: number;
  moq: number;
  delivery: string;
  status: "active" | "pending" | "paused";
}

const offers: Offer[] = [
  { id: "o1", product: "Gants Nitrile Aurelia Bold", seller: "Valerco NV", priceHT: 12.90, stock: 5000, moq: 10, delivery: "24-48h", status: "active" },
  { id: "o2", product: "Gants Nitrile Aurelia Bold", seller: "Pharmamed SRL", priceHT: 13.20, stock: 3200, moq: 5, delivery: "48h", status: "active" },
  { id: "o3", product: "Sekusept Aktiv 6 kg", seller: "MedDistri SA", priceHT: 33.59, stock: 420, moq: 2, delivery: "3-5j", status: "active" },
  { id: "o4", product: "Masques FFP2 Kolmi x50", seller: "Valerco NV", priceHT: 18.50, stock: 12000, moq: 20, delivery: "24h", status: "active" },
  { id: "o5", product: "Masques FFP2 Kolmi x50", seller: "Brussels Med Supply", priceHT: 19.80, stock: 4500, moq: 10, delivery: "48h", status: "pending" },
  { id: "o6", product: "Betadine Scrub 500ml", seller: "Pharma-GDD SRL", priceHT: 8.75, stock: 800, moq: 1, delivery: "48-72h", status: "active" },
  { id: "o7", product: "TENA Discreet Normal x12", seller: "Pharmamed SRL", priceHT: 4.03, stock: 9100, moq: 12, delivery: "24h", status: "active" },
  { id: "o8", product: "Compresses Stériles 10x10", seller: "MedDistri SA", priceHT: 4.20, stock: 3500, moq: 5, delivery: "3-5j", status: "active" },
];

const AdminProduits = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"catalog" | "offers" | "moderation">("catalog");
  const [search, setSearch] = useState("");

  const pendingCount = products.filter((p) => p.status === "pending").length;

  const tabs = [
    { key: "catalog" as const, label: "Catalogue master", count: "12 847" },
    { key: "offers" as const, label: "Offres vendeurs", count: "28 493" },
    { key: "moderation" as const, label: "À modérer", count: String(pendingCount) },
  ];

  const filteredProducts = products.filter(
    (p) =>
      (activeTab !== "moderation" || p.status === "pending") &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.cnk.includes(search) ||
        p.ean.includes(search) ||
        p.brand.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredOffers = offers.filter(
    (o) =>
      o.product.toLowerCase().includes(search.toLowerCase()) ||
      o.seller.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <AdminTopBar
        title={t("products")}
        subtitle="Catalogue PIM centralisé"
        actions={
          <button className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: "#1E293B" }}>
            <Plus size={15} />
            Ajouter un produit
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard icon={Package} label="Produits catalogue" value="12 847" evolution={{ value: 4.2, label: "vs mois dernier" }} />
        <KpiCard icon={Tag} label="Marques" value="342" iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={ShoppingCart} label="Offres actives" value="28 493" evolution={{ value: 8.7, label: "vs mois dernier" }} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={AlertTriangle} label="À modérer" value={String(pendingCount)} iconColor="#EF4343" iconBg="#FEF2F2" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent",
              color: activeTab === tab.key ? "#fff" : "#616B7C",
            }}
          >
            {tab.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.2)" : tab.key === "moderation" && pendingCount > 0 ? "#FEF2F2" : "#F1F5F9",
                color: activeTab === tab.key ? "#fff" : tab.key === "moderation" && pendingCount > 0 ? "#EF4343" : "#8B95A5",
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 max-w-md" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <Search size={14} style={{ color: "#8B95A5" }} />
          <input
            type="text"
            placeholder="Rechercher par nom, CNK, EAN, marque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-[13px] outline-none bg-transparent"
            style={{ color: "#1D2530" }}
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>
          <Filter size={14} /> Filtres
        </button>
        <button className="flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", color: "#616B7C" }}>
          <Download size={14} /> Export
        </button>
      </div>

      {/* Catalog Table */}
      {(activeTab === "catalog" || activeTab === "moderation") && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["", "Produit", "CNK", "EAN", "Marque", "Offres", "Meilleur prix", "Stock total", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/admin/produits/${p.id}`)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid #F1F5F9" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: "#F1F5F9" }}>
                      {p.image}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold block" style={{ color: "#1D2530" }}>{p.name}</span>
                    <span className="text-[11px]" style={{ color: "#8B95A5" }}>{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1B5BDA" }}>{p.cnk}</td>
                  <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{p.ean}</td>
                  <td className="px-4 py-3 text-[12px] font-medium" style={{ color: "#1D2530" }}>{p.brand}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
                      {p.nbOffers}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{p.bestPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{p.stockTotal.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Offers Table */}
      {activeTab === "offers" && (
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Produit", "Vendeur", "Prix HT", "Stock", "MOQ", "Délai", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOffers.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "#1D2530" }}>{o.product}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#1B5BDA" }}>{o.seller}</td>
                  <td className="px-4 py-3 text-[13px] font-bold" style={{ color: "#1D2530" }}>€{o.priceHT.toFixed(2)}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.moq}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "#616B7C" }}>{o.delivery}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminProduits;
