import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

export interface HeroImageRow {
  id: string;
  image_url: string;
  alt_text: string;
  title: string | null;
  subtitle: string | null;
  cta_text: string | null;
  link_url: string | null;
}

const LIMITS = {
  title: 80,
  subtitle: 120,
  cta: 30,
  url: 500,
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
  title: string;
  subtitle: string;
  cta_text: string;
  link_url: string;
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

interface Props {
  img: HeroImageRow;
}

export default function HeroImageEditor({ img }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(img.title ?? "");
  const [subtitle, setSubtitle] = useState(img.subtitle ?? "");
  const [cta, setCta] = useState(img.cta_text ?? "");
  const [link, setLink] = useState(img.link_url ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(img.title ?? "");
    setSubtitle(img.subtitle ?? "");
    setCta(img.cta_text ?? "");
    setLink(img.link_url ?? "");
  }, [img.id, img.title, img.subtitle, img.cta_text, img.link_url]);

  const errors = useMemo(
    () => validateHeroFields({ title, subtitle, cta_text: cta, link_url: link }),
    [title, subtitle, cta, link]
  );
  const hasErrors = Object.keys(errors).length > 0;

  const dirty =
    title !== (img.title ?? "") ||
    subtitle !== (img.subtitle ?? "") ||
    cta !== (img.cta_text ?? "") ||
    link !== (img.link_url ?? "");

  const isInternalLink = link.trim().startsWith("/");

  const save = async () => {
    if (hasErrors || !dirty) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("cms_hero_images")
      .update({
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        cta_text: cta.trim() || null,
        link_url: link.trim() || null,
      })
      .eq("id", img.id);
    setSaving(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-hero-images"] });
    queryClient.invalidateQueries({ queryKey: ["cms-hero-images"] });
    toast.success("Bandeau mis à jour");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
      {/* ---- Form ---- */}
      <div className="space-y-2">
        <Field
          label="Titre"
          value={title}
          onChange={setTitle}
          placeholder="Titre principal du bandeau"
          max={LIMITS.title}
          error={errors.title}
        />
        <Field
          label="Sous-titre"
          value={subtitle}
          onChange={setSubtitle}
          placeholder="Phrase d'accroche secondaire"
          max={LIMITS.subtitle}
          error={errors.subtitle}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Label CTA"
            value={cta}
            onChange={setCta}
            placeholder="Découvrir →"
            max={LIMITS.cta}
            error={errors.cta_text}
          />
          <Field
            label="URL CTA"
            value={link}
            onChange={setLink}
            placeholder="/promotions ou https://…"
            max={LIMITS.url}
            error={errors.link_url}
            hint={
              link.trim() && !errors.link_url
                ? isInternalLink
                  ? "Lien interne"
                  : "Lien externe (nouvel onglet)"
                : undefined
            }
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            disabled={!dirty || hasErrors || saving}
            onClick={save}
            className="bg-[#1B5BDA] hover:bg-[#1548B0] text-white gap-1.5 text-[11px] h-7"
          >
            <Check size={12} /> {saving ? "Enregistrement…" : dirty ? "Enregistrer" : "À jour"}
          </Button>
          {hasErrors && (
            <span className="text-[10px] text-red-600 inline-flex items-center gap-1">
              <AlertCircle size={11} /> {Object.keys(errors).length} erreur(s) à corriger
            </span>
          )}
        </div>
      </div>

      {/* ---- Live preview ---- */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#8B95A5] mb-1.5 font-semibold">
          Aperçu live
        </p>
        <div className="relative w-full rounded-xl overflow-hidden shadow-sm" style={{ aspectRatio: "16/7" }}>
          <img
            src={img.image_url}
            alt={img.alt_text}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 z-10 text-white">
            <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider opacity-80 mb-0.5 line-clamp-1">
              {subtitle || <span className="italic opacity-60">Sous-titre…</span>}
            </p>
            <h4 className="text-sm sm:text-base font-bold leading-tight line-clamp-2 max-w-[80%]">
              {title || <span className="italic opacity-60">Titre du bandeau…</span>}
            </h4>
            {cta.trim() && (
              <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-md text-[11px] font-semibold bg-white/25 backdrop-blur-sm">
                {cta}
                {link.trim() && !errors.link_url && (isInternalLink ? <Link2 size={10} /> : <ExternalLink size={10} />)}
              </span>
            )}
          </div>
        </div>
        {link.trim() && !errors.link_url && (
          <p className="text-[10px] mt-1.5 text-[#5C6470] truncate">
            <span className="font-medium">Cible :</span> {link}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, max, error, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  max: number;
  error?: string;
  hint?: string;
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
        className={`w-full text-[12px] rounded-md border px-2 py-1.5 outline-none transition-colors ${
          error
            ? "border-red-400 focus:border-red-500 bg-red-50/40"
            : "border-gray-200 focus:border-[#1B5BDA] bg-white"
        }`}
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
