import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronDown, Search, Loader2, Check } from "lucide-react";

interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
  children: CategoryNode[];
}

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
}

/**
 * Sélecteur d'arbre des catégories MediKong (3 niveaux).
 * Le vendeur coche les catégories où son offre doit être visible.
 */
export function CategoryTreeSelector({ selectedIds, onChange, required }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: categories, isLoading } = useQuery({
    queryKey: ["all-active-categories-tree"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, parent_id, is_active")
        .eq("is_active", true)
        .order("name")
        .range(0, 9999);
      return data || [];
    },
  });

  const tree = useMemo<CategoryNode[]>(() => {
    if (!categories) return [];
    const map = new Map<string, CategoryNode>();
    categories.forEach((c: any) => map.set(c.id, { id: c.id, name: c.name, parent_id: c.parent_id, children: [] }));
    const roots: CategoryNode[] = [];
    map.forEach(node => {
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [categories]);

  // Auto-expand parents of selected/searched nodes
  useEffect(() => {
    if (!categories) return;
    const map = new Map<string, any>();
    categories.forEach((c: any) => map.set(c.id, c));
    const toExpand = new Set<string>();
    selectedIds.forEach(id => {
      let cur = map.get(id);
      while (cur?.parent_id) {
        toExpand.add(cur.parent_id);
        cur = map.get(cur.parent_id);
      }
    });
    if (toExpand.size > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        toExpand.forEach(id => next.add(id));
        return next;
      });
    }
  }, [selectedIds, categories]);

  const matchesSearch = (node: CategoryNode): boolean => {
    if (!search) return true;
    const s = search.toLowerCase();
    if (node.name.toLowerCase().includes(s)) return true;
    return node.children.some(matchesSearch);
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id));
    else onChange([...selectedIds, id]);
  };

  const selectedSet = new Set(selectedIds);

  const renderNode = (node: CategoryNode, depth: number) => {
    if (!matchesSearch(node)) return null;
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id) || !!search;
    const isChecked = selectedSet.has(node.id);
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 py-1 hover:bg-[#F8FAFC] rounded px-1 transition-colors"
          style={{ paddingLeft: depth * 14 + 4 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.id)}
              className="p-0.5 hover:bg-[#E2E8F0] rounded"
              aria-label={isOpen ? "Réduire" : "Étendre"}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-[18px]" />
          )}
          <label className="flex items-center gap-1.5 cursor-pointer flex-1 text-[12px]">
            <span
              className="w-4 h-4 border rounded flex items-center justify-center flex-shrink-0"
              style={{
                borderColor: isChecked ? "#1B5BDA" : "#CBD5E1",
                backgroundColor: isChecked ? "#1B5BDA" : "white",
              }}
            >
              {isChecked && <Check size={10} className="text-white" />}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={isChecked}
              onChange={() => toggleSelect(node.id)}
            />
            <span style={{ color: "#1D2530" }}>{node.name}</span>
          </label>
        </div>
        {hasChildren && isOpen && (
          <div>{node.children.map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg" style={{ borderColor: required && selectedIds.length === 0 ? "#EF4343" : "#E2E8F0" }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "#8B95A5" }} />
          <input
            type="text"
            placeholder="Rechercher une catégorie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-[12px] border rounded focus:border-[#1B5BDA] focus:outline-none"
            style={{ borderColor: "#E2E8F0" }}
          />
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: selectedIds.length > 0 ? "#DBEAFE" : "#FEE2E2", color: selectedIds.length > 0 ? "#1B5BDA" : "#EF4343" }}>
          {selectedIds.length} sélection{selectedIds.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-[12px]" style={{ color: "#8B95A5" }}>
            <Loader2 size={12} className="animate-spin" /> Chargement de l'arborescence…
          </div>
        ) : tree.length === 0 ? (
          <p className="text-[12px] text-center py-4" style={{ color: "#8B95A5" }}>Aucune catégorie disponible.</p>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>
      {required && selectedIds.length === 0 && (
        <p className="text-[11px] px-3 py-1.5 border-t" style={{ borderColor: "#FEE2E2", color: "#EF4343", backgroundColor: "#FEF2F2" }}>
          Sélectionnez au moins une catégorie pour publier l'offre.
        </p>
      )}
    </div>
  );
}
