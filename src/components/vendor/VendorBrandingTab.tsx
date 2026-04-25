import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { Loader2, Upload, Trash2, Globe, Linkedin, Facebook, Instagram, Twitter, Youtube, User, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Vendor = any;

interface Props {
  vendor: Vendor;
}

const TEXT_FIELDS: Array<{ key: string; label: string; placeholder: string; icon?: React.ReactNode; type?: string }> = [
  { key: "tagline", label: "Accroche / Slogan", placeholder: "Ex : Votre partenaire de confiance en parapharmacie", icon: null },
  { key: "contact_person", label: "Personne de contact", placeholder: "Prénom Nom", icon: <User size={14} /> },
  { key: "website", label: "Site web", placeholder: "https://www.monsite.be", icon: <Globe size={14} />, type: "url" },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/company/...", icon: <Linkedin size={14} />, type: "url" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/...", icon: <Facebook size={14} />, type: "url" },
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/...", icon: <Instagram size={14} />, type: "url" },
  { key: "twitter_url", label: "X / Twitter", placeholder: "https://x.com/...", icon: <Twitter size={14} />, type: "url" },
  { key: "youtube_url", label: "YouTube", placeholder: "https://youtube.com/@...", icon: <Youtube size={14} />, type: "url" },
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

export default function VendorBrandingTab({ vendor }: Props) {
  const qc = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [form, setForm] = useState({
    tagline: "",
    contact_person: "",
    website: "",
    linkedin_url: "",
    facebook_url: "",
    instagram_url: "",
    twitter_url: "",
    youtube_url: "",
    description: "",
  });

  useEffect(() => {
    if (!vendor) return;
    setForm({
      tagline: vendor.tagline || "",
      contact_person: vendor.contact_person || "",
      website: vendor.website || "",
      linkedin_url: vendor.linkedin_url || "",
      facebook_url: vendor.facebook_url || "",
      instagram_url: vendor.instagram_url || "",
      twitter_url: vendor.twitter_url || "",
      youtube_url: vendor.youtube_url || "",
      description: vendor.description || "",
    });
  }, [vendor]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vendors")
        .update(form as any)
        .eq("id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branding enregistré");
      qc.invalidateQueries({ queryKey: ["current-vendor"] });
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'enregistrement"),
  });

  const uploadAsset = async (file: File, kind: "logo" | "cover") => {
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPG, WebP ou SVG)");
      return;
    }
    const maxBytes = kind === "logo" ? MAX_LOGO_BYTES : MAX_COVER_BYTES;
    if (file.size > maxBytes) {
      toast.error(`Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo)`);
      return;
    }

    const setLoading = kind === "logo" ? setUploadingLogo : setUploadingCover;
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${vendor.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("vendor-branding")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("vendor-branding").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const updateField = kind === "logo" ? "logo_url" : "cover_image_url";
      const { error: updErr } = await supabase
        .from("vendors")
        .update({ [updateField]: publicUrl } as any)
        .eq("id", vendor.id);
      if (updErr) throw updErr;

      toast.success(kind === "logo" ? "Logo mis à jour" : "Bannière mise à jour");
      qc.invalidateQueries({ queryKey: ["current-vendor"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setLoading(false);
    }
  };

  const removeAsset = async (kind: "logo" | "cover") => {
    const updateField = kind === "logo" ? "logo_url" : "cover_image_url";
    const { error } = await supabase
      .from("vendors")
      .update({ [updateField]: null } as any)
      .eq("id", vendor.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(kind === "logo" ? "Logo supprimé" : "Bannière supprimée");
    qc.invalidateQueries({ queryKey: ["current-vendor"] });
  };

  const logoUrl = vendor?.logo_url as string | undefined;
  const coverUrl = vendor?.cover_image_url as string | undefined;

  return (
    <div className="space-y-4">
      {/* Logo + Cover */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Logo */}
        <VCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#1D2530]">Logo</h3>
            <span className="text-[10px] text-[#8B95A5]">PNG/JPG/SVG · 2 Mo max</span>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center overflow-hidden flex-shrink-0"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo vendeur" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={28} className="text-[#CBD5E1]" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAsset(f, "logo");
                  e.target.value = "";
                }}
              />
              <VBtn small primary onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
                {logoUrl ? "Remplacer" : "Téléverser"}
              </VBtn>
              {logoUrl && (
                <button
                  onClick={() => removeAsset("logo")}
                  className="text-[12px] text-[#EF4343] hover:underline flex items-center gap-1"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              )}
            </div>
          </div>
        </VCard>

        {/* Cover */}
        <VCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#1D2530]">Bannière</h3>
            <span className="text-[10px] text-[#8B95A5]">PNG/JPG/WebP · 5 Mo · 1600×400 recommandé</span>
          </div>
          <div className="space-y-3">
            <div className="w-full h-24 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center overflow-hidden">
              {coverUrl ? (
                <img src={coverUrl} alt="Bannière vendeur" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={28} className="text-[#CBD5E1]" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAsset(f, "cover");
                  e.target.value = "";
                }}
              />
              <VBtn small primary onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
                {uploadingCover ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
                {coverUrl ? "Remplacer" : "Téléverser"}
              </VBtn>
              {coverUrl && (
                <button
                  onClick={() => removeAsset("cover")}
                  className="text-[12px] text-[#EF4343] hover:underline flex items-center gap-1"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              )}
            </div>
          </div>
        </VCard>
      </div>

      {/* Description publique */}
      <VCard>
        <h3 className="text-[14px] font-bold text-[#1D2530] mb-1">Description publique</h3>
        <p className="text-[11px] text-[#8B95A5] mb-3">
          Ce texte est affiché sur votre page vendeur publique. 500 caractères max.
        </p>
        <textarea
          value={form.description}
          maxLength={500}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={4}
          placeholder="Présentez votre entreprise, vos engagements, votre spécialité…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]"
        />
        <div className="text-[10px] text-[#8B95A5] mt-1 text-right">{form.description.length}/500</div>
      </VCard>

      {/* Coordonnées et réseaux */}
      <VCard>
        <h3 className="text-[14px] font-bold text-[#1D2530] mb-3">Coordonnées publiques & réseaux sociaux</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TEXT_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="text-[11px] font-semibold text-[#8B95A5] mb-1 flex items-center gap-1.5">
                {field.icon}
                {field.label}
              </label>
              <input
                type={field.type || "text"}
                value={(form as any)[field.key] || ""}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1D2530] focus:outline-none focus:border-[#1B5BDA]"
              />
            </div>
          ))}
        </div>
      </VCard>

      <div className="flex justify-end">
        <VBtn primary onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
          Enregistrer le branding
        </VBtn>
      </div>
    </div>
  );
}
