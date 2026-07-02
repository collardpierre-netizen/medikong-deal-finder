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
  Store, Shield, Users, ArrowRight, Search, XCircle, CheckCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PAGE_IMAGE_REGISTRY } from "@/data/page-image-registry";
import FeaturedCategoriesTab from "@/components/admin/FeaturedCategoriesTab";
import HeroImageEditor, { validateHeroUrl } from "@/components/admin/HeroImageEditor";
import { formatUpdatedAt } from "@/lib/format-date";

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
  title: string | null;
  subtitle: string | null;
  focal_x?: number | null;
  focal_y?: number | null;
  zoom?: number | null;
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

  // ---- Revendeur Pro state ----
  const [resellerSearch, setResellerSearch] = useState("");

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

  // ---- Revendeur Pro queries ----
  const { data: resellerProfile } = useQuery({
    queryKey: ["admin-reseller-profile"],
    queryFn: async () => {
      const { data, error } = await sb.from("buyer_profiles").select("*").eq("id", "revendeur_pro").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: resellerCustomers = [], isLoading: resellerLoading } = useQuery({
    queryKey: ["admin-reseller-customers", resellerSearch],
    queryFn: async () => {
      let q = sb.from("customers").select("id, company_name, first_name, last_name, email, phone, country, buyer_profile_id, created_at, updated_at").eq("buyer_profile_id", "revendeur_pro").order("updated_at", { ascending: false });
      if (resellerSearch.trim()) {
        q = q.or(`company_name.ilike.%${resellerSearch.trim()}%,first_name.ilike.%${resellerSearch.trim()}%,last_name.ilike.%${resellerSearch.trim()}%,email.ilike.%${resellerSearch.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: resellerExclusivities = [] } = useQuery({
    queryKey: ["admin-reseller-exclusivities"],
    queryFn: async () => {
      const { data, error } = await sb.from("vendor_exclusivities").select("*, vendors(company_name, display_code)").contains("buyer_profile_ids", ["revendeur_pro"]).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: resellerOfferCount = 0 } = useQuery({
    queryKey: ["admin-reseller-offer-count"],
    queryFn: async () => {
      const { count, error } = await sb.from("offers").select("id", { count: "exact", head: true }).eq("is_active", true).contains("buyer_profile_ids", ["revendeur_pro"]);
      if (error) throw error;
      return count || 0;
    },
  });

  const assignResellerProfile = useMutation({
    mutationFn: async ({ customerId, assign }: { customerId: string; assign: boolean }) => {
      const { error } = await sb.from("customers").update({ buyer_profile_id: assign ? "revendeur_pro" : null }).eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reseller-customers"] });
      toast.success("Profil mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
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
      <div className="px-5 -mt-2 mb-3">
        <a href="/admin/cms/partenaires-invest" className="text-xs text-mk-blue underline hover:no-underline">
          → Logos partenaires (page Invest)
        </a>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="pages" className="text-[13px]">Pages</TabsTrigger>
          <TabsTrigger value="bannieres" className="text-[13px]">Bannières</TabsTrigger>
          <TabsTrigger value="collections" className="text-[13px]">Collections</TabsTrigger>
          <TabsTrigger value="homepage" className="text-[13px]">Sections Homepage</TabsTrigger>
          <TabsTrigger value="hero-images" className="text-[13px]">Images Hero</TabsTrigger>
          <TabsTrigger value="page-images" className="text-[13px]">Images Pages</TabsTrigger>
          <TabsTrigger value="featured-cats" className="text-[13px]">Catégories vedettes</TabsTrigger>
          <TabsTrigger value="revendeur-pro" className="text-[13px] gap-1.5">
            <Store size={14} /> Espace Revendeur
          </TabsTrigger>
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
            <p className="text-[12px] mb-2" style={{ color: "#8B95A5" }}>Gérez les photos du carrousel hero. Les modifications sont appliquées en temps réel sur la homepage.</p>
            <div className="mb-4 p-3 rounded-md border text-[11px] leading-relaxed" style={{ borderColor: "#DBEAFE", backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
              <strong>Format recommandé :</strong> 1920 × 840 px (ratio ~2.28:1), JPG ou WebP, &lt; 400 Ko.
              Zone de sécurité pour le texte à gauche (~40% de la largeur). Les visages/éléments clés doivent rester dans le tiers central pour rester visibles sur mobile.
              <br />
              <strong>Comment ajouter :</strong> cliquez sur <em>Uploader une image</em> (fichier local) <em>ou</em> collez une URL externe puis <em>Ajouter URL</em>. Renseignez le texte alt, et optionnellement une URL + libellé CTA (les deux ensemble ou aucun).
            </div>

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
                <Button size="sm" onClick={() => newImageUrl && !validateHeroUrl(newLinkUrl) && addImage.mutate()} disabled={!newImageUrl || addImage.isPending || !!validateHeroUrl(newLinkUrl) || (!!newCtaText.trim() && !newLinkUrl.trim()) || (!!newLinkUrl.trim() && !newCtaText.trim())} className="bg-[#1B5BDA] hover:bg-[#1548B0] text-white gap-1.5">
                  <Plus size={14} /> Ajouter URL
                </Button>
              </div>
              <div>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="URL de destination (ex: /promotions)..."
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    aria-invalid={!!validateHeroUrl(newLinkUrl)}
                    className={`text-[13px] flex-1 ${validateHeroUrl(newLinkUrl) ? "border-red-400 bg-red-50/40" : ""}`}
                  />
                  <Input placeholder="Texte CTA (ex: Découvrir →)..." value={newCtaText} onChange={e => setNewCtaText(e.target.value)} className="text-[13px] w-[220px]" />
                </div>
                {validateHeroUrl(newLinkUrl) && (
                  <p className="text-[10px] text-red-600 mt-1">{validateHeroUrl(newLinkUrl)}</p>
                )}
                {!validateHeroUrl(newLinkUrl) && newLinkUrl.trim() && !newCtaText.trim() && (
                  <p className="text-[10px] text-red-600 mt-1">Label CTA requis si une URL est définie</p>
                )}
                {!validateHeroUrl(newLinkUrl) && newCtaText.trim() && !newLinkUrl.trim() && (
                  <p className="text-[10px] text-red-600 mt-1">URL requise si un label CTA est défini</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {heroImages.map((img, idx) => (
                <div key={img.id} className="flex flex-col lg:flex-row items-start gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <div className="flex lg:flex-col gap-1">
                    <button onClick={() => reorderImage(idx, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => reorderImage(idx, "down")} disabled={idx === heroImages.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={14} /></button>
                    <span className="text-[10px] font-bold lg:mt-1" style={{ color: "#8B95A5" }}>#{img.sort_order}</span>
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <p className="text-[11px] font-medium truncate mb-2" style={{ color: "#1D2530" }}>{img.alt_text || "Sans description"}</p>
                    <HeroImageEditor img={img} />
                  </div>
                  <div className="flex lg:flex-col items-center gap-3 lg:gap-2">
                    <button onClick={() => toggleImage.mutate({ id: img.id, is_active: !img.is_active })} className="flex items-center gap-1.5">
                      {img.is_active ? <Eye size={14} style={{ color: "#059669" }} /> : <EyeOff size={14} style={{ color: "#8B95A5" }} />}
                      <span className="text-[11px]" style={{ color: img.is_active ? "#059669" : "#8B95A5" }}>{img.is_active ? "Actif" : "Masqué"}</span>
                    </button>
                    <button onClick={() => deleteImage.mutate(img.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
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
        {/* Featured Categories tab */}
        <TabsContent value="featured-cats">
          <FeaturedCategoriesTab />
        </TabsContent>

        {/* Revendeur Pro tab */}
        <TabsContent value="revendeur-pro">
          <div className="space-y-5">
            {/* Status card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: resellerProfile?.is_active ? "#ECFDF5" : "#F1F5F9" }}>
                  <Shield size={18} style={{ color: resellerProfile?.is_active ? "#059669" : "#8B95A5" }} />
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Profil</p>
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>
                    {resellerProfile?.is_active ? "Actif" : "Inactif"}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF" }}>
                  <Users size={18} style={{ color: "#1B5BDA" }} />
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Comptes revendeurs</p>
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{resellerCustomers.length}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F3F0FF" }}>
                  <Store size={18} style={{ color: "#7C3AED" }} />
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Exclusivités</p>
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{resellerExclusivities.length}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#FFFBEB" }}>
                  <Layers size={18} style={{ color: "#F59E0B" }} />
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: "#8B95A5" }}>Offres actives</p>
                  <p className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{resellerOfferCount}</p>
                </div>
              </div>
            </div>

            {/* Search + table */}
            <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: "#E2E8F0" }}>
                <Users size={16} style={{ color: "#1B5BDA" }} />
                <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Comptes revendeurs</h3>
                <div className="flex-1" />
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#8B95A5" }} />
                  <Input
                    placeholder="Rechercher un compte…"
                    value={resellerSearch}
                    onChange={e => setResellerSearch(e.target.value)}
                    className="pl-8 text-[13px] w-[260px]"
                  />
                </div>
              </div>
              {resellerLoading ? (
                <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement…</div>
              ) : resellerCustomers.length === 0 ? (
                <div className="py-12 text-center">
                  <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
                  <p className="text-[13px]" style={{ color: "#8B95A5" }}>Aucun compte revendeur assigné</p>
                  <p className="text-[11px] mt-1" style={{ color: "#CBD5E1" }}>Assignez un profil via la fiche client ou l'admin Utilisateurs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                      {["Entreprise", "Contact", "Email", "Pays", "Assigné le", "Actions"].map(h => (
                        <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resellerCustomers.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>
                          {c.company_name || "—"}
                        </TableCell>
                        <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>
                          {c.first_name || ""} {c.last_name || ""}
                        </TableCell>
                        <TableCell className="text-[12px] font-mono" style={{ color: "#8B95A5" }}>{c.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{c.country || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-[12px]" style={{ color: "#8B95A5" }}>
                          {formatUpdatedAt(c.updated_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[11px] gap-1"
                            onClick={() => assignResellerProfile.mutate({ customerId: c.id, assign: false })}
                            disabled={assignResellerProfile.isPending}
                          >
                            <XCircle size={12} /> Retirer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Exclusivities */}
            <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: "#E2E8F0" }}>
                <Store size={16} style={{ color: "#7C3AED" }} />
                <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Exclusivités vendeurs (mode "hide")</h3>
                <div className="flex-1" />
                <a href="/admin/vendor-exclusivity-requests" className="text-[11px] text-mk-blue underline hover:no-underline flex items-center gap-1">
                  Gérer les exclusivités <ArrowRight size={12} />
                </a>
              </div>
              {resellerExclusivities.length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>
                  Aucune exclusivité revendeur configurée
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                      {["Vendeur", "Scope", "Mode", "Pays", "Créé le"].map(h => (
                        <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resellerExclusivities.map((ex: any) => (
                      <TableRow key={ex.id}>
                        <TableCell className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>
                          {ex.vendors?.company_name || ex.vendors?.display_code || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {ex.scope_type} {ex.scope_name ? `• ${ex.scope_name}` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="text-[10px]" style={{
                            backgroundColor: ex.mode === "hide" ? "#F1F5F9" : "#ECFDF5",
                            color: ex.mode === "hide" ? "#8B95A5" : "#059669",
                            borderColor: "transparent",
                          }}>
                            {ex.mode === "hide" ? "Masqué" : "Showcase"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>
                          {(ex.country_codes || []).join(", ") || "Tous"}
                        </TableCell>
                        <TableCell className="text-[12px]" style={{ color: "#8B95A5" }}>
                          {formatUpdatedAt(ex.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Info block */}
            <div className="bg-[#F8FAFC] rounded-lg border p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: "#059669" }} />
                <p className="text-[12px]" style={{ color: "#616B7C" }}>
                  Les offres avec <code>buyer_profile_ids = ['revendeur_pro']</code> et <code>mode = 'hide'</code> sont automatiquement masquées du catalogue public et visibles uniquement sur <a href="/pro" target="_blank" className="text-mk-blue underline">/pro</a>.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: "#059669" }} />
                <p className="text-[12px]" style={{ color: "#616B7C" }}>
                  Le prix appliqué est résolu via <code>offer_buyer_profile_prices</code> (override) ou <code>vendor_profile_defaults</code> (défaut vendeur).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#F59E0B" }} />
                <p className="text-[12px]" style={{ color: "#616B7C" }}>
                  Pour assigner un nouveau compte : utilisez la page <a href="/admin/users" className="text-mk-blue underline">Utilisateurs</a> ou exécutez <code>UPDATE customers SET buyer_profile_id = 'revendeur_pro' WHERE id = '...'</code>.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCMS;
