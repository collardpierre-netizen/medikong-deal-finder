import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Layout, Image, Layers, GripVertical, Eye, EyeOff, FileText, ToggleLeft, Trash2, Plus,
} from "lucide-react";
import { toast } from "sonner";

// --- Static mock data for non-DB tabs ---
const pages = [
  { name: "Homepage", slug: "/", status: "published", lastEdit: "27/03 14:00" },
  { name: "FAQ", slug: "/faq", status: "published", lastEdit: "22/03 09:30" },
  { name: "CGV", slug: "/cgv", status: "published", lastEdit: "15/03 11:00" },
  { name: "À propos", slug: "/a-propos", status: "draft", lastEdit: "20/03 16:45" },
  { name: "Politique de confidentialité", slug: "/confidentialite", status: "published", lastEdit: "10/03 10:00" },
];
const banners = [
  { name: "Promo printemps -20% EPI", position: "Homepage hero", active: true, start: "01/03", end: "31/03" },
  { name: "Livraison gratuite >200€", position: "Barre supérieure", active: true, start: "01/01", end: "31/12" },
  { name: "Nouveau : gamme Hartmann", position: "Homepage milieu", active: false, start: "15/03", end: "15/04" },
];
const collections = [
  { name: "Meilleures ventes", type: "auto", products: 50, rule: "Top 50 ventes 30j" },
  { name: "Nouveautés mars", type: "auto", products: 34, rule: "Créés < 30j" },
  { name: "Essentiels pharmacie", type: "manual", products: 28, rule: "Sélection manuelle" },
];
const homepageSections = [
  { name: "Hero Banner", visible: true, order: 1 },
  { name: "Stats marketplace", visible: true, order: 2 },
  { name: "Catégories", visible: true, order: 3 },
  { name: "Produits populaires", visible: true, order: 4 },
  { name: "Marques partenaires", visible: true, order: 5 },
  { name: "CTA Vendeur", visible: true, order: 6 },
  { name: "FAQ", visible: true, order: 7 },
];

interface HeroImage {
  id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_active: boolean;
}

const AdminCMS = () => {
  const [tab, setTab] = useState("pages");
  const [sections, setSections] = useState(homepageSections);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");
  const queryClient = useQueryClient();
  const sb = supabase as any;

  const toggleSection = (idx: number) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, visible: !s.visible } : s));
  };

  // ---- CMS Hero Images from DB ----
  const { data: heroImages = [] } = useQuery<HeroImage[]>({
    queryKey: ["admin-hero-images"],
    queryFn: async () => {
      const { data, error } = await sb.from("cms_hero_images").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const toggleImage = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb.from("cms_hero_images").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] }); queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] }); toast.success("Image mise à jour"); },
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("cms_hero_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] }); queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] }); toast.success("Image supprimée"); },
  });

  const addImage = useMutation({
    mutationFn: async () => {
      const maxOrder = heroImages.length ? Math.max(...heroImages.map(i => i.sort_order)) + 1 : 0;
      const { error } = await sb.from("cms_hero_images").insert({ image_url: newImageUrl, alt_text: newImageAlt || "", sort_order: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] });
      queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] });
      setNewImageUrl(""); setNewImageAlt("");
      toast.success("Image ajoutée");
    },
  });

  return (
    <div>
      <AdminTopBar title="CMS & Merchandising" subtitle="Gestion du contenu et de la mise en avant" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="pages" className="text-[13px]">Pages</TabsTrigger>
          <TabsTrigger value="bannieres" className="text-[13px]">Bannières</TabsTrigger>
          <TabsTrigger value="collections" className="text-[13px]">Collections</TabsTrigger>
          <TabsTrigger value="homepage" className="text-[13px]">Sections Homepage</TabsTrigger>
          <TabsTrigger value="hero-images" className="text-[13px]">Images Hero</TabsTrigger>
        </TabsList>

        {/* Pages tab */}
        <TabsContent value="pages">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Page", "Slug", "Statut", "Dernière édition"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow key={p.slug}>
                    <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                      <div className="flex items-center gap-2"><FileText size={14} style={{ color: "#1B5BDA" }} />{p.name}</div>
                    </TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{p.slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: p.status === "published" ? "#059669" : "#F59E0B",
                        backgroundColor: p.status === "published" ? "#ECFDF5" : "#FFFBEB",
                        borderColor: "transparent",
                      }}>
                        {p.status === "published" ? "Publié" : "Brouillon"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{p.lastEdit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Banners tab */}
        <TabsContent value="bannieres">
          <div className="space-y-3">
            {banners.map((b) => (
              <div key={b.name} className="bg-white rounded-lg border p-4 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: b.active ? "#ECFDF5" : "#F1F5F9" }}>
                  <Image size={16} style={{ color: b.active ? "#059669" : "#8B95A5" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{b.name}</p>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>{b.position} • {b.start} → {b.end}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleLeft size={20} style={{ color: b.active ? "#059669" : "#CBD5E1" }} />
                  <span className="text-[11px] font-medium" style={{ color: b.active ? "#059669" : "#8B95A5" }}>{b.active ? "Actif" : "Inactif"}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Collections tab */}
        <TabsContent value="collections">
          <div className="grid grid-cols-3 gap-4">
            {collections.map((c) => (
              <div key={c.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={14} style={{ color: "#7C3AED" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{c.name}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: c.type === "auto" ? "#1B5BDA" : "#7C3AED",
                    backgroundColor: c.type === "auto" ? "#EFF6FF" : "#F3F0FF",
                    borderColor: "transparent",
                  }}>
                    {c.type === "auto" ? "Automatique" : "Manuelle"}
                  </Badge>
                  <span className="text-[11px]" style={{ color: "#8B95A5" }}>{c.products} produits</span>
                </div>
                <p className="text-[11px]" style={{ color: "#616B7C" }}>{c.rule}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Homepage sections tab */}
        <TabsContent value="homepage">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Sections Homepage (ordre d'affichage)</h3>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <GripVertical size={14} style={{ color: "#CBD5E1" }} className="cursor-grab" />
                  <span className="text-[11px] font-bold w-6" style={{ color: "#8B95A5" }}>{s.order}</span>
                  <span className="text-[13px] font-medium flex-1" style={{ color: "#1D2530" }}>{s.name}</span>
                  <button onClick={() => toggleSection(i)} className="flex items-center gap-1.5">
                    {s.visible ? <Eye size={14} style={{ color: "#059669" }} /> : <EyeOff size={14} style={{ color: "#8B95A5" }} />}
                    <span className="text-[11px]" style={{ color: s.visible ? "#059669" : "#8B95A5" }}>{s.visible ? "Visible" : "Masqué"}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Hero Images tab — LIVE from DB */}
        <TabsContent value="hero-images">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Images Hero Homepage</h3>
            <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>Gérez les photos du carrousel hero. Les modifications sont appliquées en temps réel sur la homepage.</p>

            <div className="flex gap-2 mb-6">
              <Input placeholder="URL de l'image..." value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} className="text-[13px] flex-1" />
              <Input placeholder="Texte alt..." value={newImageAlt} onChange={e => setNewImageAlt(e.target.value)} className="text-[13px] w-[200px]" />
              <Button size="sm" onClick={() => newImageUrl && addImage.mutate()} disabled={!newImageUrl || addImage.isPending} className="bg-[#1B5BDA] hover:bg-[#1548B0] text-white gap-1.5">
                <Plus size={14} /> Ajouter
              </Button>
            </div>

            <div className="space-y-3">
              {heroImages.map((img) => (
                <div key={img.id} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <img src={img.image_url} alt={img.alt_text} className="w-20 h-14 object-cover rounded-lg border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: "#1D2530" }}>{img.alt_text || "Sans description"}</p>
                    <p className="text-[10px] truncate" style={{ color: "#8B95A5" }}>{img.image_url}</p>
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: "#8B95A5" }}>#{img.sort_order}</span>
                  <button onClick={() => toggleImage.mutate({ id: img.id, is_active: !img.is_active })} className="flex items-center gap-1.5">
                    {img.is_active ? <Eye size={14} style={{ color: "#059669" }} /> : <EyeOff size={14} style={{ color: "#8B95A5" }} />}
                    <span className="text-[11px]" style={{ color: img.is_active ? "#059669" : "#8B95A5" }}>{img.is_active ? "Actif" : "Masqué"}</span>
                  </button>
                  <button onClick={() => deleteImage.mutate(img.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              {heroImages.length === 0 && (
                <p className="text-center text-[12px] py-6" style={{ color: "#8B95A5" }}>Aucune image hero configurée</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCMS;
