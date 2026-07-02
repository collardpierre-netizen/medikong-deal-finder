import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Check, ExternalLink, Link2, Monitor, Smartphone, RotateCcw, Info, Upload, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { formatHeroInline } from "@/lib/hero-inline-format";

export interface HeroImageRow {
  id: string;
  image_url: string;
  image_url_mobile?: string | null;
  alt_text: string;
  title: string | null;
  subtitle: string | null;
  show_title?: boolean | null;
  show_subtitle?: boolean | null;
  cta_text: string | null;
  link_url: string | null;
  show_cta?: boolean | null;
  focal_x?: number | null;
  focal_y?: number | null;
  zoom?: number | null;
}

const LIMITS = { title: 80, subtitle: 120, cta: 30, url: 500 };

// Dimensions recommandées pour le rendu public (HeroImageGallery : ratio ~16/7, hauteur 340px).
const RECOMMENDED = {
  width: 1920,
  height: 840,
  ratio: 1920 / 840,
  minWidth: 1200,
  ratioTolerance: 0.15,
};

// Mobile : ratio 4/3 recommandé (crop plus haut, ~800×600).
const RECOMMENDED_MOBILE = {
  width: 800,
  height: 600,
  ratio: 4 / 3,
};

export function validateHeroUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.length > LIMITS.url) return `URL trop longue (max ${LIMITS.url})`;
  if (v.startsWith("/")) {
    if (/\s/.test(v)) return "URL interne : pas d'espaces";
    return null;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "URL : http(s):// ou /chemin-interne";
    return null;
  } catch {
    return "URL invalide (ex : /promotions ou https://…)";
  }
}

export function validateHeroFields(f: {
  title: string; subtitle: string; cta_text: string; link_url: string;
}): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.title.length > LIMITS.title) e.title = `Max ${LIMITS.title} caractères`;
  if (f.subtitle.length > LIMITS.subtitle) e.subtitle = `Max ${LIMITS.subtitle} caractères`;
  if (f.cta_text.length > LIMITS.cta) e.cta_text = `Max ${LIMITS.cta} caractères`;
  const urlErr = validateHeroUrl(f.link_url);
  if (urlErr) e.link_url = urlErr;
  if (f.cta_text.trim() && !f.link_url.trim()) e.link_url = "URL requise si un label CTA est défini";
  if (f.link_url.trim() && !f.cta_text.trim()) e.cta_text = "Label requis si une URL est définie";
  return e;
}

interface Props { img: HeroImageRow; }

export default function HeroImageEditor({ img }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(img.title ?? "");
  const [subtitle, setSubtitle] = useState(img.subtitle ?? "");
  const [showTitle, setShowTitle] = useState<boolean>(img.show_title ?? true);
  const [showSubtitle, setShowSubtitle] = useState<boolean>(img.show_subtitle ?? true);
  const [cta, setCta] = useState(img.cta_text ?? "");
  const [link, setLink] = useState(img.link_url ?? "");
  const [showCta, setShowCta] = useState<boolean>(img.show_cta ?? true);
  const [imageUrlMobile, setImageUrlMobile] = useState<string>(img.image_url_mobile ?? "");
  const [focalX, setFocalX] = useState<number>(Number(img.focal_x ?? 50));
  const [focalY, setFocalY] = useState<number>(Number(img.focal_y ?? 50));
  const [zoom, setZoom] = useState<number>(Number(img.zoom ?? 1));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [dimsMobile, setDimsMobile] = useState<{ w: number; h: number } | null>(null);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(img.title ?? "");
    setSubtitle(img.subtitle ?? "");
    setShowTitle(img.show_title ?? true);
    setShowSubtitle(img.show_subtitle ?? true);
    setCta(img.cta_text ?? "");
    setLink(img.link_url ?? "");
    setShowCta(img.show_cta ?? true);
    setImageUrlMobile(img.image_url_mobile ?? "");
    setFocalX(Number(img.focal_x ?? 50));
    setFocalY(Number(img.focal_y ?? 50));
    setZoom(Number(img.zoom ?? 1));
  }, [img.id, img.title, img.subtitle, img.show_title, img.show_subtitle, img.cta_text, img.link_url, img.show_cta, img.image_url_mobile, img.focal_x, img.focal_y, img.zoom]);

  // Détection dimensions image source
  useEffect(() => {
    setDims(null);
    const i = new Image();
    i.onload = () => setDims({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => setDims(null);
    i.src = img.image_url;
  }, [img.image_url]);

  useEffect(() => {
    setDimsMobile(null);
    if (!imageUrlMobile.trim()) return;
    const i = new Image();
    i.onload = () => setDimsMobile({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => setDimsMobile(null);
    i.src = imageUrlMobile;
  }, [imageUrlMobile]);

  const errors = useMemo(
    () => validateHeroFields({ title, subtitle, cta_text: cta, link_url: link }),
    [title, subtitle, cta, link]
  );
  const hasErrors = Object.keys(errors).length > 0;

  const dirty =
    title !== (img.title ?? "") ||
    subtitle !== (img.subtitle ?? "") ||
    showTitle !== (img.show_title ?? true) ||
    showSubtitle !== (img.show_subtitle ?? true) ||
    cta !== (img.cta_text ?? "") ||
    link !== (img.link_url ?? "") ||
    showCta !== (img.show_cta ?? true) ||
    imageUrlMobile !== (img.image_url_mobile ?? "") ||
    focalX !== Number(img.focal_x ?? 50) ||
    focalY !== Number(img.focal_y ?? 50) ||
    zoom !== Number(img.zoom ?? 1);

  const isInternalLink = link.trim().startsWith("/");

  // Diagnostic dimensions desktop
  const dimStatus = useMemo(() => {
    if (!dims) return null;
    const ratio = dims.w / dims.h;
    const ratioDelta = Math.abs(ratio - RECOMMENDED.ratio) / RECOMMENDED.ratio;
    const issues: string[] = [];
    if (dims.w < RECOMMENDED.minWidth) issues.push(`Trop petit (min ${RECOMMENDED.minWidth}px)`);
    if (ratioDelta > RECOMMENDED.ratioTolerance) issues.push(`Ratio ${ratio.toFixed(2)} — visez ${RECOMMENDED.ratio.toFixed(2)}`);
    return { ratio, issues };
  }, [dims]);

  const save = async () => {
    if (hasErrors || !dirty) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("cms_hero_images")
      .update({
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        show_title: showTitle,
        show_subtitle: showSubtitle,
        cta_text: cta.trim() || null,
        link_url: link.trim() || null,
        show_cta: showCta,
        image_url_mobile: imageUrlMobile.trim() || null,
        focal_x: focalX,
        focal_y: focalY,
        zoom,
      })
      .eq("id", img.id);
    setSaving(false);
    if (error) { toast.error("Erreur : " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] });
    queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] });
    toast.success("Bandeau mis à jour");
  };

  const resetCrop = () => { setFocalX(50); setFocalY(50); setZoom(1); };

  const handleMobileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Fichier non supporté"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setUploadingMobile(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `hero-mobile-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cms-images").upload(`hero/${fileName}`, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("cms-images").getPublicUrl(`hero/${fileName}`);
      setImageUrlMobile(urlData.publicUrl);
      toast.success("Image mobile uploadée — pensez à enregistrer");
    } catch (err: any) {
      toast.error("Erreur upload : " + (err.message || "inconnue"));
    } finally {
      setUploadingMobile(false);
      if (mobileFileRef.current) mobileFileRef.current.value = "";
    }
  };

  const effectiveMobileSrc = imageUrlMobile.trim() || img.image_url;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
      {/* ---- Form ---- */}
      <div className="space-y-2">
        <FieldWithToggle
          label="Titre"
          value={title} onChange={setTitle}
          placeholder="Titre principal du bandeau"
          max={LIMITS.title} error={errors.title}
          enabled={showTitle} onEnabledChange={setShowTitle}
        />
        <FieldWithToggle
          label="Sous-titre"
          value={subtitle} onChange={setSubtitle}
          placeholder="Phrase d'accroche secondaire"
          max={LIMITS.subtitle} error={errors.subtitle}
          enabled={showSubtitle} onEnabledChange={setShowSubtitle}
        />
        <p className="text-[10px] text-[#5C6470] -mt-1 pl-1">
          Mise en forme : <code className="bg-gray-100 px-1 rounded">**gras**</code> et <code className="bg-gray-100 px-1 rounded">[texte](/lien)</code>
        </p>
        <div className="rounded-md border border-gray-200 bg-gray-50/60 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6470] inline-flex items-center gap-2">
              CTA (bouton + lien)
              <Switch
                checked={showCta}
                onCheckedChange={setShowCta}
                aria-label="Afficher le CTA"
                className="scale-75 origin-left"
              />
              <span className={`text-[9px] font-medium normal-case tracking-normal ${showCta ? "text-emerald-700" : "text-[#8B95A5]"}`}>
                {showCta ? "Affiché" : "Masqué"}
              </span>
            </label>
          </div>
          <div className={`grid grid-cols-2 gap-2 ${!showCta ? "opacity-50" : ""}`}>
            <Field label="Label CTA" value={cta} onChange={setCta} placeholder="Découvrir →" max={LIMITS.cta} error={errors.cta_text} disabled={!showCta} />
            <Field
              label="URL CTA" value={link} onChange={setLink} placeholder="/promotions ou https://…"
              max={LIMITS.url} error={errors.link_url}
              hint={link.trim() && !errors.link_url ? (isInternalLink ? "Lien interne" : "Lien externe (nouvel onglet)") : undefined}
              disabled={!showCta}
            />
          </div>
        </div>

        {/* Image mobile dédiée */}
        <div className="rounded-md border border-gray-200 bg-gray-50/60 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6470]">
              Image mobile <span className="text-[9px] text-[#8B95A5] normal-case tracking-normal">(facultatif — sinon l'image desktop est utilisée)</span>
            </p>
            {imageUrlMobile && (
              <button
                type="button"
                onClick={() => setImageUrlMobile("")}
                className="text-[10px] text-red-600 inline-flex items-center gap-1 hover:underline"
              >
                <XIcon size={10} /> Retirer
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={imageUrlMobile}
              onChange={(e) => setImageUrlMobile(e.target.value)}
              placeholder="https://… (ratio 4/3 recommandé)"
              className="flex-1 text-[12px] rounded-md border border-gray-200 px-2 py-1.5 outline-none focus:border-[#1B5BDA] bg-white"
            />
            <input
              ref={mobileFileRef}
              type="file"
              accept="image/*"
              onChange={handleMobileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => mobileFileRef.current?.click()}
              disabled={uploadingMobile}
              className="px-2 py-1.5 text-[11px] rounded-md border border-gray-200 bg-white text-[#5C6470] hover:border-[#1B5BDA] hover:text-[#1B5BDA] inline-flex items-center gap-1 disabled:opacity-60"
            >
              <Upload size={11} /> {uploadingMobile ? "Upload…" : "Uploader"}
            </button>
          </div>
          <p className="text-[10px] text-[#8B95A5]">
            Cible : <strong>{RECOMMENDED_MOBILE.width}×{RECOMMENDED_MOBILE.height}px</strong> · ratio ~{RECOMMENDED_MOBILE.ratio.toFixed(2)}:1 (portrait cadré serré).
          </p>
          {imageUrlMobile && dimsMobile && (
            <p className="text-[10px] text-emerald-700 tabular-nums">
              Image mobile : {dimsMobile.w}×{dimsMobile.h}px (ratio {(dimsMobile.w / dimsMobile.h).toFixed(2)})
            </p>
          )}
        </div>

        {/* Recadrage */}
        <div className="rounded-md border border-gray-200 bg-gray-50/60 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5C6470]">Recadrage</p>
            <button
              type="button"
              onClick={resetCrop}
              className="text-[10px] text-[#5C6470] hover:text-[#1B5BDA] inline-flex items-center gap-1"
            >
              <RotateCcw size={10} /> Centrer
            </button>
          </div>
          <CropSlider label="Horizontal" value={focalX} onChange={setFocalX} min={0} max={100} unit="%" />
          <CropSlider label="Vertical" value={focalY} onChange={setFocalY} min={0} max={100} unit="%" />
          <CropSlider label="Zoom" value={zoom} onChange={setZoom} min={1} max={3} step={0.05} unit="×" fixed={2} />
        </div>

        {/* Dimensions recommandées desktop */}
        <div className="rounded-md border border-gray-200 bg-white p-2 text-[10.5px] text-[#5C6470] space-y-1">
          <p className="inline-flex items-center gap-1 font-semibold text-[#1E252F]">
            <Info size={11} /> Dimensions recommandées (desktop)
          </p>
          <p>
            Cible : <strong>{RECOMMENDED.width}×{RECOMMENDED.height}px</strong> · ratio ~{RECOMMENDED.ratio.toFixed(2)}:1 (paysage panoramique) · JPG/WebP &lt; 400 Ko.
          </p>
          {dims && (
            <p className="tabular-nums">
              Image actuelle :{" "}
              <span className={dimStatus?.issues.length ? "text-orange-600 font-semibold" : "text-emerald-700 font-semibold"}>
                {dims.w}×{dims.h}px (ratio {dimStatus?.ratio.toFixed(2)})
              </span>
              {dimStatus?.issues.length ? " — " + dimStatus.issues.join(" · ") : " ✓"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm" disabled={!dirty || hasErrors || saving} onClick={save}
            className="bg-[#1B5BDA] hover:bg-[#1548B0] text-white gap-1.5 text-[11px] h-7"
          >
            <Check size={12} /> {saving ? "Enregistrement…" : dirty ? "Enregistrer" : "À jour"}
          </Button>
          {hasErrors && (
            <span className="text-[10px] text-red-600 inline-flex items-center gap-1">
              <AlertCircle size={11} /> {Object.keys(errors).length} erreur(s) à corriger
            </span>
          )}
          {dirty && !hasErrors && (
            <span className="text-[10px] text-orange-600">Modifications non publiées</span>
          )}
        </div>
      </div>

      {/* ---- Live preview ---- */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-wider text-[#8B95A5] font-semibold">
            Aperçu live {dirty && <span className="text-orange-600">· non publié</span>}
          </p>
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
            <button
              type="button" onClick={() => setDevice("desktop")}
              className={`px-2 py-1 text-[10px] inline-flex items-center gap-1 ${device === "desktop" ? "bg-[#1B5BDA] text-white" : "text-[#5C6470]"}`}
            >
              <Monitor size={11} /> Desktop
            </button>
            <button
              type="button" onClick={() => setDevice("mobile")}
              className={`px-2 py-1 text-[10px] inline-flex items-center gap-1 ${device === "mobile" ? "bg-[#1B5BDA] text-white" : "text-[#5C6470]"}`}
            >
              <Smartphone size={11} /> Mobile
            </button>
          </div>
        </div>

        <PreviewFrame
          image_url={device === "mobile" ? effectiveMobileSrc : img.image_url}
          alt={img.alt_text}
          title={showTitle ? title : ""}
          subtitle={showSubtitle ? subtitle : ""}
          showTitle={showTitle}
          showSubtitle={showSubtitle}
          cta={cta}
          showCta={showCta}
          link={link}
          linkError={errors.link_url}
          isInternalLink={isInternalLink}
          focalX={focalX}
          focalY={focalY}
          zoom={zoom}
          device={device}
        />

        {device === "mobile" && !imageUrlMobile.trim() && (
          <p className="text-[10px] mt-1 text-[#8B95A5] italic">
            Aucune image mobile dédiée — l'image desktop est utilisée.
          </p>
        )}
        {link.trim() && !errors.link_url && (
          <p className="text-[10px] mt-1.5 text-[#5C6470] truncate">
            <span className="font-medium">Cible :</span> {link}
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewFrame({
  image_url, alt, title, subtitle, showTitle, showSubtitle,
  cta, showCta, link, linkError, isInternalLink,
  focalX, focalY, zoom, device,
}: {
  image_url: string; alt: string; title: string; subtitle: string;
  showTitle: boolean; showSubtitle: boolean;
  cta: string; showCta: boolean; link: string; linkError?: string; isInternalLink: boolean;
  focalX: number; focalY: number; zoom: number;
  device: "desktop" | "mobile";
}) {
  const aspect = device === "desktop" ? "16/7" : "4/3";
  const maxW = device === "desktop" ? "100%" : 320;
  const ctaVisible = showCta && Boolean(cta.trim());
  const hasAnyText = showTitle || showSubtitle || ctaVisible;
  return (
    <div className="flex justify-center bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl p-2">
      <div
        className="relative w-full rounded-xl overflow-hidden shadow-sm bg-black"
        style={{ aspectRatio: aspect, maxWidth: maxW }}
      >
        <img
          src={image_url}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: `${focalX}% ${focalY}%`,
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
            transformOrigin: `${focalX}% ${focalY}%`,
          }}
        />
        {hasAnyText && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
        )}
        {/* Repère centre de crop */}
        <div
          className="absolute pointer-events-none w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${focalX}%`, top: `${focalY}%` }}
          aria-hidden
        />
        {hasAnyText && (
          <div className="absolute bottom-3 left-3 right-3 z-10 text-white">
            {showSubtitle && (
              <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider opacity-80 mb-0.5 line-clamp-1">
                {subtitle ? formatHeroInline(subtitle) : <span className="italic opacity-60">Sous-titre…</span>}
              </p>
            )}
            {showTitle && (
              <h4 className="text-sm sm:text-base font-bold leading-tight line-clamp-2 max-w-[80%]">
                {title ? formatHeroInline(title) : <span className="italic opacity-60">Titre du bandeau…</span>}
              </h4>
            )}
            {ctaVisible && (
              <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-md text-[11px] font-semibold bg-white/25 backdrop-blur-sm">
                {cta}
                {link.trim() && !linkError && (isInternalLink ? <Link2 size={10} /> : <ExternalLink size={10} />)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CropSlider({
  label, value, onChange, min, max, step = 1, unit = "", fixed = 0,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; unit?: string; fixed?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[10px] text-[#5C6470]">{label}</label>
        <span className="text-[10px] tabular-nums text-[#1E252F] font-semibold">{value.toFixed(fixed)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-[#1B5BDA] cursor-pointer"
      />
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, max, error, hint, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; max: number; error?: string; hint?: string; disabled?: boolean;
}) {
  const over = value.length > max;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6470]">{label}</label>
        <span className={`text-[9px] tabular-nums ${over ? "text-red-600 font-semibold" : "text-[#8B95A5]"}`}>
          {value.length}/{max}
        </span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        disabled={disabled}
        className={`w-full text-[12px] rounded-md border px-2 py-1.5 outline-none transition-colors ${
          error ? "border-red-400 focus:border-red-500 bg-red-50/40" : "border-gray-200 focus:border-[#1B5BDA] bg-white"
        } ${disabled ? "opacity-60 bg-gray-50 cursor-not-allowed" : ""}`}
      />
      {error ? (
        <p className="text-[10px] text-red-600 mt-0.5 inline-flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </p>
      ) : hint ? (
        <p className="text-[10px] text-[#8B95A5] mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}

function FieldWithToggle({
  label, value, onChange, placeholder, max, error,
  enabled, onEnabledChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; max: number; error?: string;
  enabled: boolean; onEnabledChange: (v: boolean) => void;
}) {
  const over = value.length > max;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5 gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6470] inline-flex items-center gap-2">
          {label}
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label={`Afficher ${label.toLowerCase()}`}
            className="scale-75 origin-left"
          />
          <span className={`text-[9px] font-medium normal-case tracking-normal ${enabled ? "text-emerald-700" : "text-[#8B95A5]"}`}>
            {enabled ? "Affiché" : "Masqué"}
          </span>
        </label>
        <span className={`text-[9px] tabular-nums ${over ? "text-red-600 font-semibold" : "text-[#8B95A5]"}`}>
          {value.length}/{max}
        </span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        disabled={!enabled}
        className={`w-full text-[12px] rounded-md border px-2 py-1.5 outline-none transition-colors ${
          error ? "border-red-400 focus:border-red-500 bg-red-50/40" : "border-gray-200 focus:border-[#1B5BDA] bg-white"
        } ${!enabled ? "opacity-50 bg-gray-50" : ""}`}
      />
      {error && (
        <p className="text-[10px] text-red-600 mt-0.5 inline-flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}
