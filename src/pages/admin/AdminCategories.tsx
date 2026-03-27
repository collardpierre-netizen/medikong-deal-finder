import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Layers, Tag, Package, ChevronDown, ChevronRight } from "lucide-react";

const categoryTree = [
  {
    name: "Dispositifs médicaux", count: 4200, children: [
      { name: "Pansements & Soins plaies", count: 1200, subs: ["Compresses", "Pansements adhésifs", "Pansements hydrocolloïdes", "Bandes"] },
      { name: "Instruments chirurgicaux", count: 950, subs: ["Ciseaux", "Pinces", "Bistouris", "Rétracteurs"] },
      { name: "Diagnostic", count: 680, subs: ["Tensiomètres", "Thermomètres", "Oxymètres", "Stéthoscopes"] },
      { name: "Injection & Perfusion", count: 520, subs: ["Seringues", "Aiguilles", "Cathéters", "Sets de perfusion"] },
      { name: "Incontinence", count: 420, subs: ["Protections légères", "Changes complets", "Alèses", "Culottes absorbantes"] },
      { name: "Mobilier médical", count: 310, subs: ["Lits médicalisés", "Fauteuils roulants", "Déambulateurs", "Tables d'examen"] },
    ],
  },
  {
    name: "EPI & Protection", count: 2400, children: [
      { name: "Gants", count: 890, subs: ["Nitrile", "Latex", "Vinyle", "Chirurgicaux"] },
      { name: "Masques", count: 650, subs: ["Chirurgicaux", "FFP2", "FFP3", "Visières"] },
      { name: "Blouses & Tabliers", count: 380, subs: ["Jetables", "Réutilisables", "Stériles"] },
      { name: "Charlottes & Surchaussures", count: 280, subs: ["Charlottes", "Surchaussures", "Couvre-barbe"] },
    ],
  },
  {
    name: "Désinfection", count: 1800, children: [
      { name: "SHA (Solutions hydroalcooliques)", count: 420, subs: ["Gel", "Mousse", "Spray", "Lingettes"] },
      { name: "Surfaces", count: 380, subs: ["Sprays", "Concentrés", "Lingettes", "Nettoyants"] },
      { name: "Instruments", count: 350, subs: ["Stérilisation", "Prédésinfection", "Bacs", "Autoclaves"] },
      { name: "Cutanés", count: 280, subs: ["Antiseptiques", "Povidone iodée", "Chlorhexidine"] },
    ],
  },
  {
    name: "Respiratoire", count: 450, children: [
      { name: "Oxygénothérapie", count: 180, subs: ["Concentrateurs", "Bouteilles", "Masques O2", "Lunettes"] },
      { name: "Nébuliseurs", count: 150, subs: ["Pneumatiques", "Ultrasoniques", "Mesh"] },
      { name: "Aérosolthérapie", count: 120, subs: ["Chambres d'inhalation", "Embouts", "Filtres"] },
    ],
  },
  {
    name: "Textile & EPI", count: 380, children: [
      { name: "Draps d'examen", count: 120 },
      { name: "Champs opératoires", count: 90 },
      { name: "Vêtements médicaux", count: 170, subs: ["Tuniques", "Pantalons", "Sabots"] },
    ],
  },
  {
    name: "OTC — Dermocosmetique", count: 1200, children: [
      { name: "Visage", count: 450, subs: ["Crèmes hydratantes", "Anti-âge", "Sérums", "Nettoyants"] },
      { name: "Corps", count: 320, subs: ["Laits", "Baumes", "Huiles"] },
      { name: "Dermatologie", count: 430, subs: ["Eczéma", "Psoriasis", "Acné", "Cicatrisation"] },
    ],
  },
  {
    name: "OTC — Hygiène corporelle", count: 980, children: [
      { name: "Douche & Bain", count: 280 },
      { name: "Shampooings", count: 220, subs: ["Antipelliculaires", "Doux", "Traitants"] },
      { name: "Déodorants", count: 180 },
      { name: "Hygiène intime", count: 150 },
    ],
  },
  {
    name: "OTC — Vitamines & Compléments", count: 850, children: [
      { name: "Multivitamines", count: 220 },
      { name: "Probiotiques", count: 180 },
      { name: "Phytothérapie", count: 250 },
      { name: "Minéraux", count: 200 },
    ],
  },
  {
    name: "OTC — Bébé & Maternité", count: 620, children: [
      { name: "Couches", count: 180 },
      { name: "Lait infantile", count: 150 },
      { name: "Soins bébé", count: 190 },
      { name: "Maternité", count: 100 },
    ],
  },
  {
    name: "OTC — Auto-médication", count: 780, children: [
      { name: "Douleur", count: 220 },
      { name: "Rhume & Grippe", count: 180 },
      { name: "Allergie", count: 150 },
      { name: "Digestion", count: 230 },
    ],
  },
];

const recentTags = ["Nitrile", "FFP2", "SHA", "Stérile", "Kolmi", "CE Classe I", "TENA", "Incontinence légère", "Probiotiques", "Dermatologie", "Bio", "Sans latex"];

const AdminCategories = () => {
  const [expanded, setExpanded] = useState<string[]>([categoryTree[0].name]);

  const toggle = (name: string) => {
    setExpanded(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const totalParents = categoryTree.length;
  const totalSubs = categoryTree.reduce((a, c) => a + (c.children?.length || 0), 0);
  const totalProducts = categoryTree.reduce((a, c) => a + c.count, 0);

  return (
    <div>
      <AdminTopBar title="Catégories" subtitle="Arborescence du catalogue produits" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Layers} label="Catégories parentes" value={String(totalParents)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Tag} label="Sous-catégories" value={String(totalSubs)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Package} label="Produits catégorisés" value={totalProducts.toLocaleString("fr-BE")} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={Tag} label="Tags récents" value={String(recentTags.length)} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Tree */}
        <div className="col-span-2 bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Arborescence</h3>
          <div className="space-y-1">
            {categoryTree.map((cat) => (
              <div key={cat.name}>
                <button
                  onClick={() => toggle(cat.name)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {expanded.includes(cat.name) ? <ChevronDown size={14} style={{ color: "#8B95A5" }} /> : <ChevronRight size={14} style={{ color: "#8B95A5" }} />}
                  <Layers size={14} style={{ color: "#1B5BDA" }} />
                  <span className="text-[13px] font-semibold flex-1" style={{ color: "#1D2530" }}>{cat.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>{cat.count.toLocaleString("fr-BE")}</span>
                </button>
                {expanded.includes(cat.name) && cat.children && (
                  <div className="ml-8 space-y-0.5">
                    {cat.children.map((sub) => (
                      <div key={sub.name}>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50">
                          <Tag size={12} style={{ color: "#7C3AED" }} />
                          <span className="text-[12px] flex-1" style={{ color: "#616B7C" }}>{sub.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#F3F0FF", color: "#7C3AED" }}>{sub.count}</span>
                        </div>
                        {"subs" in sub && sub.subs && (
                          <div className="ml-6 flex flex-wrap gap-1 px-3 py-1">
                            {sub.subs.map((s) => (
                              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F8FAFC", color: "#8B95A5" }}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent tags */}
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Tags récents</h3>
          <div className="flex flex-wrap gap-2">
            {recentTags.map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer hover:bg-blue-100 transition-colors" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCategories;
