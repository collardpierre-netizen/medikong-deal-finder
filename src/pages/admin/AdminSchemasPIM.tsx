import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useI18n } from "@/contexts/I18nContext";
import {
  Layers, ChevronDown, ChevronRight, Search, Package, SlidersHorizontal,
  Puzzle, ListTree, Filter as FilterIcon,
} from "lucide-react";

interface SubCategory {
  name: string;
  variants: number;
  pools: string[];
}

interface ParentCategory {
  name: string;
  subcats: SubCategory[];
}

interface TopCategory {
  name: string;
  parents: ParentCategory[];
}

const taxonomy: TopCategory[] = [
  {
    name: "Médical",
    parents: [
      { name: "Équipement médical", subcats: [
        { name: "Seringues", variants: 48, pools: ["contenance", "gauge"] },
        { name: "Aiguilles", variants: 36, pools: ["gauge", "couleur"] },
        { name: "Cathéters IV", variants: 24, pools: ["gauge", "connectivite"] },
        { name: "Tubulures", variants: 18, pools: ["connectivite", "contenance"] },
      ]},
      { name: "Soins & Hygiène", subcats: [
        { name: "Masques", variants: 52, pools: ["taille_vetement", "couleur"] },
        { name: "Gants", variants: 84, pools: ["taille_vetement", "couleur"] },
        { name: "Blouses", variants: 28, pools: ["taille_vetement"] },
        { name: "Sondes", variants: 22, pools: ["gauge", "contenance"] },
        { name: "Drains", variants: 16, pools: ["gauge"] },
      ]},
      { name: "Nutrition médicale", subcats: [
        { name: "CNO", variants: 32, pools: ["contenance", "saveur_otc"] },
        { name: "Entérale", variants: 18, pools: ["contenance", "connectivite"] },
        { name: "Épaississants", variants: 12, pools: ["contenance"] },
      ]},
      { name: "Incontinence", subcats: [
        { name: "Protections", variants: 44, pools: ["taille_vetement"] },
        { name: "Changes complets", variants: 36, pools: ["taille_vetement"] },
        { name: "Pants", variants: 28, pools: ["taille_vetement"] },
        { name: "Alèses", variants: 14, pools: ["dimensions"] },
        { name: "Collecteurs", variants: 8, pools: ["contenance"] },
      ]},
      { name: "Plaies", subcats: [
        { name: "Pansements primaires", variants: 38, pools: ["dimensions", "adhesif"] },
        { name: "Pansements adhésifs", variants: 42, pools: ["dimensions", "adhesif"] },
        { name: "Compresses", variants: 24, pools: ["dimensions"] },
        { name: "Bandes", variants: 20, pools: ["dimensions"] },
        { name: "Sets de soins", variants: 12, pools: [] },
      ]},
      { name: "Diagnostic", subcats: [
        { name: "Tensiomètres", variants: 16, pools: ["connectivite"] },
        { name: "Glucomètres", variants: 12, pools: ["connectivite"] },
        { name: "Oxymètres", variants: 8, pools: ["connectivite"] },
        { name: "Thermomètres", variants: 14, pools: ["connectivite"] },
      ]},
      { name: "Mobilité", subcats: [
        { name: "Fauteuils roulants", variants: 10, pools: ["dimensions"] },
        { name: "Déambulateurs", variants: 8, pools: ["dimensions"] },
        { name: "Anti-escarres", variants: 18, pools: ["dimensions"] },
      ]},
      { name: "Désinfection", subcats: [
        { name: "SHA", variants: 22, pools: ["contenance"] },
        { name: "Surfaces", variants: 18, pools: ["contenance"] },
        { name: "Cutanés", variants: 14, pools: ["contenance"] },
      ]},
      { name: "Respiratoire", subcats: [
        { name: "Oxygénothérapie", variants: 10, pools: ["connectivite"] },
        { name: "Nébuliseurs", variants: 8, pools: ["connectivite"] },
      ]},
      { name: "Textile / EPI", subcats: [
        { name: "Textile médical", variants: 20, pools: ["taille_vetement", "couleur"] },
      ]},
    ],
  },
  {
    name: "OTC",
    parents: [
      { name: "Dermocosmétique", subcats: [
        { name: "Visage", variants: 34, pools: ["contenance_cosm", "fragrance", "spf"] },
        { name: "Corps", variants: 28, pools: ["contenance_cosm", "fragrance"] },
        { name: "Dermato", variants: 18, pools: ["contenance_cosm"] },
      ]},
      { name: "Hygiène corporelle", subcats: [
        { name: "Douche & Bain", variants: 22, pools: ["contenance_cosm", "fragrance"] },
        { name: "Shampoings", variants: 26, pools: ["contenance_cosm", "fragrance"] },
        { name: "Déodorants", variants: 18, pools: ["contenance_cosm", "fragrance"] },
        { name: "Hygiène intime", variants: 12, pools: ["contenance_cosm"] },
      ]},
      { name: "Bucco-dentaire", subcats: [
        { name: "Dentifrices", variants: 24, pools: ["contenance_cosm", "saveur_otc"] },
        { name: "Brosses à dents", variants: 16, pools: ["couleur"] },
        { name: "Bains de bouche", variants: 10, pools: ["contenance_cosm", "saveur_otc"] },
      ]},
      { name: "Vitamines & Compléments", subcats: [
        { name: "Multivitamines", variants: 20, pools: ["forme_otc", "saveur_otc"] },
        { name: "Probiotiques", variants: 14, pools: ["forme_otc"] },
        { name: "Phytothérapie", variants: 18, pools: ["forme_otc"] },
      ]},
      { name: "Bébé & Maternité", subcats: [
        { name: "Couches", variants: 32, pools: ["taille_pediatrique"] },
        { name: "Lait infantile", variants: 16, pools: ["contenance"] },
        { name: "Soins bébé", variants: 20, pools: ["contenance_cosm"] },
        { name: "Maternité", variants: 10, pools: ["taille_vetement"] },
      ]},
      { name: "Solaire", subcats: [
        { name: "Crèmes solaires", variants: 22, pools: ["spf", "contenance_cosm"] },
        { name: "Après-soleil", variants: 12, pools: ["contenance_cosm"] },
      ]},
      { name: "Sexualité", subcats: [
        { name: "Préservatifs", variants: 18, pools: ["saveur_otc"] },
        { name: "Lubrifiants", variants: 10, pools: ["contenance_cosm"] },
        { name: "Tests", variants: 6, pools: [] },
      ]},
      { name: "Auto-médication", subcats: [
        { name: "Douleur & Fièvre", variants: 28, pools: ["forme_otc"] },
        { name: "Rhume & Grippe", variants: 22, pools: ["forme_otc", "saveur_otc"] },
        { name: "Allergie", variants: 14, pools: ["forme_otc"] },
        { name: "Digestion", variants: 18, pools: ["forme_otc", "saveur_otc"] },
      ]},
      { name: "Optique", subcats: [
        { name: "Lentilles", variants: 20, pools: ["contenance"] },
        { name: "Solutions", variants: 12, pools: ["contenance"] },
      ]},
    ],
  },
];

const globalAttributes = [
  { name: "Nombre de pièces", type: "integer" },
  { name: "Stérile", type: "boolean" },
  { name: "Sans latex", type: "boolean" },
  { name: "Usage", type: "enum (unique/réutilisable)" },
  { name: "Température stockage", type: "range (°C)" },
  { name: "Durée de vie", type: "integer (mois)" },
];

const pools = [
  { name: "taille_vetement", values: "XS, S, M, L, XL, XXL", used: 8 },
  { name: "taille_pediatrique", values: "Préma, Newborn, 1, 2, 3, 4, 5, 6", used: 1 },
  { name: "dimensions", values: "LxlxH (cm)", used: 7 },
  { name: "contenance", values: "ml, L", used: 11 },
  { name: "gauge", values: "G14-G30, Fr4-Fr24", used: 4 },
  { name: "couleur", values: "Palette 12 couleurs", used: 5 },
  { name: "adhesif", values: "Acrylique, Silicone, Hydrocolloïde, Sans", used: 2 },
  { name: "connectivite", values: "Luer, Luer-Lock, Bayonet, Bluetooth", used: 5 },
  { name: "contenance_cosm", values: "ml (15-1000)", used: 8 },
  { name: "fragrance", values: "Sans parfum, Floral, Frais, Boisé", used: 4 },
  { name: "spf", values: "15, 20, 30, 50, 50+", used: 2 },
  { name: "forme_otc", values: "Comprimé, Gélule, Sirop, Sachet, Spray, Gouttes", used: 5 },
  { name: "saveur_otc", values: "Neutre, Menthe, Fraise, Orange, Citron", used: 4 },
];

const AdminSchemasPIM = () => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [selectedSubcat, setSelectedSubcat] = useState<SubCategory | null>(null);
  const [selectedParentName, setSelectedParentName] = useState("");

  const totalSubcats = taxonomy.reduce((acc, t) => acc + t.parents.reduce((a, p) => a + p.subcats.length, 0), 0);
  const totalParents = taxonomy.reduce((acc, t) => acc + t.parents.length, 0);
  const totalVariants = taxonomy.reduce((acc, t) => acc + t.parents.reduce((a, p) => a + p.subcats.reduce((s, sc) => s + sc.variants, 0), 0), 0);

  const toggleParent = (key: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredTaxonomy = taxonomy.map((top) => ({
    ...top,
    parents: top.parents
      .map((p) => ({
        ...p,
        subcats: p.subcats.filter((sc) => !search || sc.name.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase())),
      }))
      .filter((p) => p.subcats.length > 0 || p.name.toLowerCase().includes(search.toLowerCase())),
  })).filter((t) => t.parents.length > 0);

  return (
    <div>
      <AdminTopBar title={t("pimSchemas")} subtitle="Architecture de données produit — 4 niveaux d'héritage" />

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <KpiCard icon={Layers} label="Sous-catégories" value={String(totalSubcats)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={ListTree} label="Parents" value={String(totalParents)} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={Puzzle} label="Pools" value={String(pools.length)} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Package} label="Variants" value={totalVariants.toLocaleString()} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={FilterIcon} label="Facettes" value={String(globalAttributes.length + pools.length)} iconColor="#E70866" iconBg="#FDF2F8" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="col-span-4 rounded-[10px] overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
          <div className="p-3" style={{ borderBottom: "1px solid #E2E8F0" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ backgroundColor: "#F8FAFC" }}>
              <Search size={14} style={{ color: "#8B95A5" }} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-[12px] outline-none bg-transparent"
                style={{ color: "#1D2530" }}
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
            {filteredTaxonomy.map((top) => (
              <div key={top.name}>
                <div className="px-4 py-2 text-[10px] font-bold tracking-wider" style={{ backgroundColor: "#F8FAFC", color: "#8B95A5" }}>
                  {top.name.toUpperCase()}
                </div>
                {top.parents.map((parent) => {
                  const key = `${top.name}-${parent.name}`;
                  const isExpanded = expandedParents.has(key) || !!search;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggleParent(key)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-[13px] font-medium hover:bg-gray-50 transition-colors"
                        style={{ color: "#1D2530" }}
                      >
                        {isExpanded ? <ChevronDown size={14} style={{ color: "#8B95A5" }} /> : <ChevronRight size={14} style={{ color: "#8B95A5" }} />}
                        {parent.name}
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>
                          {parent.subcats.length}
                        </span>
                      </button>
                      {isExpanded && parent.subcats.map((sc) => (
                        <button
                          key={sc.name}
                          onClick={() => { setSelectedSubcat(sc); setSelectedParentName(parent.name); }}
                          className="w-full text-left pl-10 pr-4 py-1.5 text-[12px] hover:bg-blue-50 transition-colors"
                          style={{
                            color: selectedSubcat?.name === sc.name ? "#1B5BDA" : "#616B7C",
                            backgroundColor: selectedSubcat?.name === sc.name ? "#EFF6FF" : "transparent",
                            fontWeight: selectedSubcat?.name === sc.name ? 600 : 400,
                          }}
                        >
                          {sc.name}
                          <span className="float-right text-[10px]" style={{ color: "#8B95A5" }}>{sc.variants}v</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="col-span-8 space-y-4">
          {!selectedSubcat ? (
            <>
              {/* Global Attributes */}
              <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>L0</span>
                  Attributs globaux
                </h3>
                <div className="space-y-2">
                  {globalAttributes.map((a) => (
                    <div key={a.name} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <span className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{a.name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>{a.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pools */}
              <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
                <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2" style={{ color: "#1D2530" }}>
                  <Puzzle size={16} style={{ color: "#059669" }} /> Pools réutilisables
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {pools.map((p) => (
                    <div key={p.name} className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold font-mono" style={{ color: "#1B5BDA" }}>{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#F0FDF4", color: "#059669" }}>
                          {p.used} sous-cats
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: "#8B95A5" }}>{p.values}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Selected subcategory detail */
            <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#F0FDF4", color: "#059669" }}>L2</span>
                <h3 className="text-[16px] font-bold" style={{ color: "#1D2530" }}>{selectedSubcat.name}</h3>
                <span className="text-[12px]" style={{ color: "#8B95A5" }}>← {selectedParentName}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <p className="text-[18px] font-bold" style={{ color: "#1B5BDA" }}>{selectedSubcat.variants}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Variants</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <p className="text-[18px] font-bold" style={{ color: "#059669" }}>{selectedSubcat.pools.length}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Pools</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <p className="text-[18px] font-bold" style={{ color: "#7C3AED" }}>{globalAttributes.length + selectedSubcat.pools.length}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Attributs totaux</p>
                </div>
              </div>

              <h4 className="text-[13px] font-semibold mb-2" style={{ color: "#1D2530" }}>Héritage résolu</h4>
              <div className="space-y-1.5">
                {globalAttributes.map((a) => (
                  <div key={a.name} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <span className="text-[12px]" style={{ color: "#616B7C" }}>{a.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>Global</span>
                  </div>
                ))}
                {selectedSubcat.pools.map((poolName) => {
                  const pool = pools.find((p) => p.name === poolName);
                  return (
                    <div key={poolName} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <div>
                        <span className="text-[12px] font-mono" style={{ color: "#1B5BDA" }}>{poolName}</span>
                        {pool && <span className="text-[10px] ml-2" style={{ color: "#8B95A5" }}>{pool.values}</span>}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#F0FDF4", color: "#059669" }}>Pool</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSchemasPIM;
