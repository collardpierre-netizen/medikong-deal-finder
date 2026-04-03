import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface FeaturedCategory {
  id: string;
  category_id: string;
  sort_order: number;
  is_active: boolean;
  categories?: { id: string; name: string; name_fr: string | null; slug: string } | null;
}

const FeaturedCategoriesTab = () => {
  const queryClient = useQueryClient();
  const sb = supabase as any;
  const [addingCatId, setAddingCatId] = useState("");

  const { data: featured = [] } = useQuery<FeaturedCategory[]>({
    queryKey: ["admin-featured-categories"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("cms_featured_categories")
        .select("*, categories(id, name, name_fr, slug)")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin-all-categories-for-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, slug, parent_id")
        .eq("is_active", true)
        .is("parent_id", null)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const usedCatIds = new Set(featured.map(f => f.category_id));
  const availableCategories = allCategories.filter(c => !usedCatIds.has(c.id));

  const addFeatured = useMutation({
    mutationFn: async (categoryId: string) => {
      const maxOrder = featured.length ? Math.max(...featured.map(f => f.sort_order)) + 1 : 0;
      const { error } = await sb.from("cms_featured_categories").insert({ category_id: categoryId, sort_order: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-featured-categories"] });
      setAddingCatId("");
      toast.success("Catégorie ajoutée");
    },
  });

  const removeFeatured = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("cms_featured_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-featured-categories"] });
      toast.success("Catégorie retirée");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb.from("cms_featured_categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-featured-categories"] });
      toast.success("Mis à jour");
    },
  });

  const reorder = async (idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= featured.length) return;
    const a = featured[idx];
    const b = featured[swapIdx];
    await Promise.all([
      sb.from("cms_featured_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      sb.from("cms_featured_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    queryClient.invalidateQueries({ queryKey: ["admin-featured-categories"] });
  };

  const getCatName = (f: FeaturedCategory) => {
    const cat = f.categories;
    if (!cat) return "—";
    return cat.name_fr || cat.name;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Les catégories vedettes sont mises en avant par défaut sur le shop (tri par pertinence). Les produits de ces catégories apparaissent en premier.
      </p>

      <div className="flex items-center gap-3">
        <Select value={addingCatId} onValueChange={setAddingCatId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Ajouter une catégorie..." />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name_fr || c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!addingCatId || addFeatured.isPending}
          onClick={() => addFeatured.mutate(addingCatId)}
        >
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#F8FAFC" }}>
              <TableHead className="text-[11px] font-semibold w-12" style={{ color: "#8B95A5" }}>#</TableHead>
              <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Catégorie</TableHead>
              <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Statut</TableHead>
              <TableHead className="text-[11px] font-semibold text-right" style={{ color: "#8B95A5" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featured.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  Aucune catégorie vedette configurée
                </TableCell>
              </TableRow>
            )}
            {featured.map((f, idx) => (
              <TableRow key={f.id}>
                <TableCell className="text-[12px] font-mono" style={{ color: "#8B95A5" }}>{idx + 1}</TableCell>
                <TableCell className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>
                  {getCatName(f)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: f.is_active ? "#059669" : "#8B95A5",
                    backgroundColor: f.is_active ? "#ECFDF5" : "#F1F5F9",
                    borderColor: "transparent",
                  }}>
                    {f.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorder(idx, "up")} disabled={idx === 0}>
                      <ArrowUp size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorder(idx, "down")} disabled={idx === featured.length - 1}>
                      <ArrowDown size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive.mutate({ id: f.id, is_active: !f.is_active })}>
                      {f.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFeatured.mutate(f.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FeaturedCategoriesTab;
