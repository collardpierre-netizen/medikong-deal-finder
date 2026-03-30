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
  Layout, Image, Layers, GripVertical, Eye, EyeOff, FileText, ToggleLeft, Trash2, Plus, Upload, ArrowUp, ArrowDown, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PAGE_IMAGE_REGISTRY } from "@/data/page-image-registry";

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
  link_url: string | null;
  cta_text: string | null;
}

const AdminCMS = () => {
  const [tab, setTab] = useState("pages");
  const [sections, setSections] = useState(homepageSections);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newCtaText, setNewCtaText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const sb = supabase as any;
  const pageFileInputRef = useRef<HTMLInputElement>(null);
  const [pageUploading, setPageUploading] = useState(false);
  const [activePageUpload, setActivePageUpload] = useState<{ pageKey: string; sectionKey: string } | null>(null);

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

  // ---- CMS Page Images from DB ----
  const { data: pageImages = [] } = useQuery<{ id: string; page_key: string; section_key: string; image_url: string; alt_text: string }[]>({
    queryKey: ["admin-page-images"],
    queryFn: async () => {
      const { data, error } = await sb.from("cms_page_images").select("*");
      if (error) throw error;
      return data;
    },
  });

  const deletePageImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("cms_page_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-page-images"] }); queryClient.invalidateQueries({ queryKey: ["cms-page-images"] }); toast.success("Image supprimée"); },
  });

  const handlePageImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePageUpload) return;
    if (!file.type.startsWith("image/")) { toast.error("Fichier non supporté"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setPageUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${activePageUpload.pageKey}-${activePageUpload.sectionKey}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("cms-images").upload(`pages/${fileName}`, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("cms-images").getPublicUrl(`pages/${fileName}`);
      // Upsert: delete existing then insert
      await sb.from("cms_page_images").delete().eq("page_key", activePageUpload.pageKey).eq("section_key", activePageUpload.sectionKey);
      const { error } = await sb.from("cms_page_images").insert({
        page_key: activePageUpload.pageKey,
        section_key: activePageUpload.sectionKey,
        image_url: urlData.publicUrl,
        alt_text: file.name,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-page-images"] });
      queryClient.invalidateQueries({ queryKey: ["cms-page-images"] });
      toast.success("Image uploadée");
    } catch (err: any) {
      toast.error("Erreur : " + (err.message || "inconnue"));
    } finally {
      setPageUploading(false);
      setActivePageUpload(null);
      if (pageFileInputRef.current) pageFileInputRef.current.value = "";
    }
  };
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

  const reorderImage = async (idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= heroImages.length) return;
    const a = heroImages[idx];
    const b = heroImages[swapIdx];
    await Promise.all([
      sb.from("cms_hero_images").update({ sort_order: b.sort_order }).eq("id", a.id),
      sb.from("cms_hero_images").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] });
    queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] });
  };

  const insertHeroImage = async (imageUrl: string, altText: string, linkUrl?: string, ctaText?: string) => {
    const maxOrder = heroImages.length ? Math.max(...heroImages.map(i => i.sort_order)) + 1 : 0;
    const { error } = await sb.from("cms_hero_images").insert({ image_url: imageUrl, alt_text: altText || "", sort_order: maxOrder, link_url: linkUrl || null, cta_text: ctaText || null });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] });
    queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] });
  };

  const addImage = useMutation({
    mutationFn: async () => { await insertHeroImage(newImageUrl, newImageAlt, newLinkUrl, newCtaText); },
    onSuccess: () => { setNewImageUrl(""); setNewImageAlt(""); setNewLinkUrl(""); setNewCtaText(""); toast.success("Image ajoutée"); },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Fichier non supporté, veuillez choisir une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `hero-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("cms-images").upload(`hero/${fileName}`, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("cms-images").getPublicUrl(`hero/${fileName}`);
      await insertHeroImage(urlData.publicUrl, newImageAlt || file.name, newLinkUrl, newCtaText);
      setNewImageAlt("");
      setNewLinkUrl("");
      setNewCtaText("");
      toast.success("Image uploadée et ajoutée");
    } catch (err: any) {
      toast.error("Erreur upload : " + (err.message || "inconnue"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
          <TabsTrigger value="page-images" className="text-[13px]">Images Pages</TabsTrigger>
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

            {/* Upload file */}
            <div className="flex flex-col gap-3 mb-6 p-4 rounded-lg border border-dashed" style={{ borderColor: "#CBD5E1" }}>
              <div className="flex gap-2 items-center">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
                  <Upload size={14} /> {uploading ? "Upload en cours…" : "Uploader une image"}
                </Button>
                <Input placeholder="Texte alt (optionnel)..." value={newImageAlt} onChange={e => setNewImageAlt(e.target.value)} className="text-[13px] w-[220px]" />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-[11px] text-muted-foreground">ou</span>
                <Input placeholder="URL externe de l'image..." value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} className="text-[13px] flex-1" />
                <Button size="sm" onClick={() => newImageUrl && addImage.mutate()} disabled={!newImageUrl || addImage.isPending} className="bg-[#1B5BDA] hover:bg-[#1548B0] text-white gap-1.5">
                  <Plus size={14} /> Ajouter URL
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                <Input placeholder="URL de destination (ex: /promotions)..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="text-[13px] flex-1" />
                <Input placeholder="Texte CTA (ex: Découvrir →)..." value={newCtaText} onChange={e => setNewCtaText(e.target.value)} className="text-[13px] w-[220px]" />
              </div>
            </div>

            <div className="space-y-3">
              {heroImages.map((img, idx) => (
                <div key={img.id} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => reorderImage(idx, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => reorderImage(idx, "down")} disabled={idx === heroImages.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={14} /></button>
                  </div>
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

        {/* Page Images tab */}
        <TabsContent value="page-images">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-2" style={{ color: "#1D2530" }}>Images des pages statiques</h3>
            <p className="text-[12px] mb-5" style={{ color: "#8B95A5" }}>
              Uploadez des images pour remplacer les placeholders sur les pages publiques (Devenir vendeur, Vérification fournisseurs, etc.).
            </p>
            <input type="file" accept="image/*" ref={pageFileInputRef} onChange={handlePageImageUpload} className="hidden" />
            <div className="space-y-2">
              {PAGE_IMAGE_REGISTRY.map((slot) => {
                const existing = pageImages.find(
                  (i) => i.page_key === slot.pageKey && i.section_key === slot.sectionKey
                );
                return (
                  <div key={`${slot.pageKey}-${slot.sectionKey}`} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                    {existing ? (
                      <img src={existing.image_url} alt={existing.alt_text} className="w-20 h-14 object-cover rounded-lg border border-border" />
                    ) : (
                      <div className="w-20 h-14 rounded-lg border border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                        <ImageIcon size={16} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{slot.label}</p>
                      <p className="text-[10px]" style={{ color: "#8B95A5" }}>
                        {existing ? existing.image_url.split("/").pop() : "Aucune image configurée"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-[11px]"
                        disabled={pageUploading}
                        onClick={() => {
                          setActivePageUpload({ pageKey: slot.pageKey, sectionKey: slot.sectionKey });
                          pageFileInputRef.current?.click();
                        }}
                      >
                        <Upload size={12} /> {existing ? "Remplacer" : "Uploader"}
                      </Button>
                      {existing && (
                        <button onClick={() => deletePageImage.mutate(existing.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCMS;
