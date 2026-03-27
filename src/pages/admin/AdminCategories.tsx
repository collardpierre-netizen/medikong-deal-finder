import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useCategories } from "@/hooks/useAdminData";
import { Layers, Tag, Package, ChevronDown, ChevronRight } from "lucide-react";

const AdminCategories = () => {
  const { data: categoriesData = [], isLoading } = useCategories();
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (name: string) => {
    setExpanded(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // Build tree from flat list
  const parents = categoriesData.filter(c => !c.parent_id);
  const children = (parentId: string) => categoriesData.filter(c => c.parent_id === parentId);

  const totalParents = parents.length;
  const totalSubs = categoriesData.filter(c => c.parent_id).length;
  const totalProducts = categoriesData.reduce((a, c) => a + (c.product_count || 0), 0);

  // Auto-expand first parent
  if (parents.length > 0 && expanded.length === 0) {
    expanded.push(parents[0].name_fr);
  }

  return (
    <div>
      <AdminTopBar title="Catégories" subtitle="Arborescence du catalogue produits" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Layers} label="Catégories parentes" value={String(totalParents)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Tag} label="Sous-catégories" value={String(totalSubs)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Package} label="Produits catégorisés" value={totalProducts.toLocaleString("fr-BE")} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={Tag} label="Total" value={String(categoriesData.length)} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Arborescence</h3>
            <div className="space-y-1">
              {parents.map((cat) => {
                const subs = children(cat.id);
                return (
                  <div key={cat.id}>
                    <button onClick={() => toggle(cat.name_fr)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
                      {subs.length > 0 ? (
                        expanded.includes(cat.name_fr) ? <ChevronDown size={14} style={{ color: "#8B95A5" }} /> : <ChevronRight size={14} style={{ color: "#8B95A5" }} />
                      ) : <div className="w-3.5" />}
                      <Layers size={14} style={{ color: "#1B5BDA" }} />
                      <span className="text-[13px] font-semibold flex-1" style={{ color: "#1D2530" }}>{cat.name_fr}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#8B95A5" }}>
                        {(cat.product_count || 0).toLocaleString("fr-BE")}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.status === "active" ? "#ECFDF5" : "#FFFBEB", color: cat.status === "active" ? "#059669" : "#D97706" }}>
                        {cat.status === "active" ? "Actif" : cat.status}
                      </span>
                    </button>
                    {expanded.includes(cat.name_fr) && subs.length > 0 && (
                      <div className="ml-8 space-y-0.5">
                        {subs.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50">
                            <Tag size={12} style={{ color: "#7C3AED" }} />
                            <span className="text-[12px] flex-1" style={{ color: "#616B7C" }}>{sub.name_fr}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#F3F0FF", color: "#7C3AED" }}>{sub.product_count || 0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Langues disponibles</h3>
            <div className="space-y-2">
              {categoriesData.filter(c => c.name_nl).slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium" style={{ color: "#1D2530" }}>{c.name_fr}</span>
                  <span style={{ color: "#8B95A5" }}>→</span>
                  <span style={{ color: "#7C3AED" }}>{c.name_nl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
