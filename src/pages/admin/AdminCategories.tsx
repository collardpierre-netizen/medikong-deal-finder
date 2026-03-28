import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useAdminData";
import { useQueryClient } from "@tanstack/react-query";
import { exportCategories, importCategories } from "@/lib/xlsx-utils";
import { toast } from "sonner";
import { Layers, Tag, Package, ChevronDown, ChevronRight, Download, Upload } from "lucide-react";

const AdminCategories = () => {
  const qc = useQueryClient();
  const { data: categoriesData = [], isLoading } = useCategories();
  const [expanded, setExpanded] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    toast.info("Import en cours...");
    try {
      const result = await importCategories(file);
      toast.success(`${result.created} catégories importée(s)`);
      if (result.errors.length > 0) toast.warning(`${result.errors.length} erreur(s): ${result.errors[0]}`);
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur import");
    }
  };

  const toggle = (name: string) => {
    setExpanded(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const parents = categoriesData.filter(c => !c.parent_id);
  const children = (parentId: string) => categoriesData.filter(c => c.parent_id === parentId);

  const totalParents = parents.length;
  const totalSubs = categoriesData.filter(c => c.parent_id).length;

  if (parents.length > 0 && expanded.length === 0) {
    expanded.push(parents[0].name);
  }

  return (
    <div>
      <AdminTopBar title="Catégories" subtitle="Arborescence du catalogue produits" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Layers} label="Catégories parentes" value={String(totalParents)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Tag} label="Sous-catégories" value={String(totalSubs)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Package} label="Total" value={String(categoriesData.length)} iconColor="#059669" iconBg="#ECFDF5" />
      </div>

      {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
        <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Arborescence</h3>
          <div className="space-y-1">
            {parents.map((cat) => {
              const subs = children(cat.id);
              return (
                <div key={cat.id}>
                  <button onClick={() => toggle(cat.name)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
                    {subs.length > 0 ? (
                      expanded.includes(cat.name) ? <ChevronDown size={14} style={{ color: "#8B95A5" }} /> : <ChevronRight size={14} style={{ color: "#8B95A5" }} />
                    ) : <div className="w-3.5" />}
                    <Layers size={14} style={{ color: "#1B5BDA" }} />
                    <span className="text-[13px] font-semibold flex-1" style={{ color: "#1D2530" }}>{cat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.is_active ? "#ECFDF5" : "#FFFBEB", color: cat.is_active ? "#059669" : "#D97706" }}>
                      {cat.is_active ? "Actif" : "Inactif"}
                    </span>
                  </button>
                  {expanded.includes(cat.name) && subs.length > 0 && (
                    <div className="ml-8 space-y-0.5">
                      {subs.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50">
                          <Tag size={12} style={{ color: "#7C3AED" }} />
                          <span className="text-[12px] flex-1" style={{ color: "#616B7C" }}>{sub.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
