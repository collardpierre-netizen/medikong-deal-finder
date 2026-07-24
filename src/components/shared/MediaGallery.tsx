import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Film, ImageIcon, Download, Loader2, BookOpen, Megaphone, Share2, X, Check, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import balaoohLogo from "@/assets/logo-medikong.png";

export type MediaOwner = { brandId: string } | { manufacturerId: string };

type MediaItem = {
  id: string;
  asset_type: "catalogue" | "affiche" | "video" | "fiche" | "brochure";
  language: string;
  visibility: "public" | "authenticated" | "premium";
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  page_count: number | null;
  tags: string[];
  sort_order: number;
  published_at: string | null;
};

const TYPE_LABEL: Record<MediaItem["asset_type"], string> = {
  catalogue: "Catalogue",
  affiche: "Affiche",
  video: "Vidéo",
  fiche: "Fiche produit",
  brochure: "Brochure",
};

const TYPE_ICON: Record<MediaItem["asset_type"], typeof FileText> = {
  catalogue: BookOpen,
  affiche: Megaphone,
  video: Film,
  fiche: FileText,
  brochure: BookOpen,
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isImageMime(mime: string | null | undefined) {
  return !!mime && mime.startsWith("image/");
}
function isVideoMime(mime: string | null | undefined) {
  return !!mime && mime.startsWith("video/");
}
function isPdfMime(mime: string | null | undefined) {
  return !!mime && mime.includes("pdf");
}

export function MediaGallery({ owner, title = "Médias officiels" }: { owner: MediaOwner; title?: string }) {
  const ownerKey = "brandId" in owner ? `brand:${owner.brandId}` : `manufacturer:${owner.manufacturerId}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["media-gallery", ownerKey],
    queryFn: async () => {
      const fn = "brandId" in owner ? "list-brand-media" : "list-manufacturer-media";
      const params = "brandId" in owner
        ? { brand_id: owner.brandId, page_size: 24 }
        : { manufacturer_id: owner.manufacturerId, page_size: 24 };
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      const { data: session } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      if (session?.session?.access_token) {
        headers.Authorization = `Bearer ${session.session.access_token}`;
      } else {
        headers.Authorization = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
      }
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return (json.items ?? []) as MediaItem[];
    },
  });

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-mk-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des médias…
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-mk-navy flex items-center gap-2 mb-3">
        <ImageIcon size={18} /> {title}
        <span className="text-sm font-normal text-mk-sec">({data.length})</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.map((item, i) => (
          <MediaCard key={item.id} item={item} onOpen={() => setOpenIndex(i)} />
        ))}
      </div>

      <MediaPartnerBanner owner={owner} ownerKey={ownerKey} />

      <MediaLightbox
        items={data}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNav={(d) => setOpenIndex((idx) => (idx == null ? idx : (idx + d + data.length) % data.length))}
      />
    </section>
  );
}

const UTM_DEFAULTS: Record<string, string> = {
  utm_source: "medikong",
  utm_medium: "media_banner",
  utm_campaign: "brand_partner",
};

function pushUtmConflict(payload: Record<string, unknown>) {
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: "media_partner_utm_conflict", partner: "medikong", ...payload });
  } catch {
    /* no-op */
  }
}

function buildPartnerUrl(rawUrl: string, ownerKey: string): string {
  try {
    const u = new URL(rawUrl);
    const params = u.searchParams;

    // 1. Déduplique les clés UTM présentes plusieurs fois (garde la première occurrence)
    //    et logge le conflit pour visibilité GTM.
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    for (const key of utmKeys) {
      const all = params.getAll(key);
      if (all.length > 1) {
        pushUtmConflict({
          reason: "duplicate_param",
          owner_key: ownerKey,
          param: key,
          values: all,
        });
        const kept = all[0];
        params.delete(key);
        params.set(key, kept);
      }
    }

    // 2. Pour utm_source/medium/campaign : on ne réécrit pas si le partenaire en a déjà un,
    //    mais on logge si sa valeur diffère de notre défaut (utile pour audit).
    for (const [key, defVal] of Object.entries(UTM_DEFAULTS)) {
      const current = params.get(key);
      if (current === null) {
        params.set(key, defVal);
      } else if (current !== defVal) {
        pushUtmConflict({
          reason: "default_overridden_by_partner",
          owner_key: ownerKey,
          param: key,
          partner_value: current,
          medikong_default: defVal,
        });
      }
    }

    // 3. utm_content DOIT toujours correspondre à ownerKey (cohérence tracking attribution).
    //    Si le partenaire a injecté une valeur différente, on l'écrase et on logge le conflit.
    const currentContent = params.get("utm_content");
    if (currentContent !== ownerKey) {
      if (currentContent !== null && currentContent !== "") {
        pushUtmConflict({
          reason: "utm_content_overridden",
          owner_key: ownerKey,
          partner_value: currentContent,
        });
      }
      params.set("utm_content", ownerKey);
    }

    return u.toString();
  } catch {
    return rawUrl;
  }
}

function trackPartnerBannerClick(
  ownerKey: string,
  href: string,
  ctaLabel: string,
  bannerId: string | number | null,
) {
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({
      event: "media_partner_banner_click",
      partner: "medikong",
      owner_key: ownerKey,
      cta_label: ctaLabel,
      offer_id: bannerId,
      destination: href,
    });
  } catch {
    /* no-op */
  }
}


function MediaPartnerBanner({ owner, ownerKey }: { owner: MediaOwner; ownerKey: string }) {
  const brandId = "brandId" in owner ? owner.brandId : null;
  const manufacturerId = "manufacturerId" in owner ? owner.manufacturerId : null;

  const { data } = useQuery({
    queryKey: ["media-banner-pick", brandId, manufacturerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pick_media_banner", {
        p_brand_id: brandId,
        p_manufacturer_id: manufacturerId,
      });
      if (error) throw error;
      // Supabase RPC returning a composite type -> single row object (or null)
      return (Array.isArray(data) ? data[0] : data) as
        | {
            id: string;
            enabled: boolean;
            partner_name: string | null;
            title: string | null;
            subtitle: string | null;
            cta_label: string | null;
            cta_url: string | null;
            logo_url: string | null;
          }
        | null;
    },
    staleTime: 5 * 60_000,
  });

  if (!data || !data.cta_url) return null;

  const trackedHref = buildPartnerUrl(data.cta_url, ownerKey);
  const ctaLabel = data.cta_label || `Découvrir ${data.partner_name || "le partenaire"}`;
  // Vrai identifiant du bandeau (chaque ligne media_banners = un deal distinct)
  const bannerId = data.id;
  const logoSrc = data.logo_url || balaoohLogo;
  const partnerLabel = data.partner_name || "Partenaire";

  return (
    <a
      href={trackedHref}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => trackPartnerBannerClick(ownerKey, trackedHref, ctaLabel, bannerId)}
      onAuxClick={(e) => { if (e.button === 1) trackPartnerBannerClick(ownerKey, trackedHref, ctaLabel, bannerId); }}
      data-tracking="media-partner-banner"
      data-owner-key={ownerKey}
      data-banner-id={bannerId}
      className="group mt-5 block relative overflow-hidden rounded-2xl border border-mk-line bg-gradient-to-br from-mk-navy via-mk-navy to-[#0b1e4a] p-5 md:p-7 hover:shadow-xl transition-all"
    >
      {/* Glow décoratif */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-gradient-to-br from-pink-400/30 via-fuchsia-400/20 to-indigo-400/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-24 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-300/20 via-rose-300/20 to-violet-400/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-7">
        <div className="shrink-0 flex md:block items-center">
          <img
            src={logoSrc}
            alt={partnerLabel}
            className="h-14 md:h-16 w-auto object-contain drop-shadow-[0_4px_20px_rgba(236,72,153,0.35)]"
            loading="lazy"
          />
        </div>

        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-1.5">
            <span className="h-1 w-1 rounded-full bg-fuchsia-400" /> Partenaire officiel · Sponsorisé
          </span>
          {data.title && (
            <h3 className="text-white font-bold text-base md:text-xl leading-snug font-display">
              {data.title}
            </h3>
          )}
          {data.subtitle && (
            <p className="text-white/75 text-sm md:text-[15px] mt-1.5 leading-relaxed">
              {data.subtitle}
            </p>
          )}
        </div>

        <span className="inline-flex items-center gap-2 bg-white text-mk-navy font-semibold text-sm px-5 py-3 rounded-xl shrink-0 shadow-md group-hover:shadow-lg group-hover:translate-x-0.5 transition-all">
          {ctaLabel}
          <ArrowUpRight size={16} />
        </span>
      </div>
    </a>
  );
}



function MediaCard({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const Icon = TYPE_ICON[item.asset_type];
  const isVideo = item.asset_type === "video" || isVideoMime(item.mime_type);

  const { data: thumbUrl } = useQuery({
    queryKey: ["media-thumb", item.id],
    queryFn: async () => {
      if (!item.thumbnail_path) return null;
      const { data, error } = await supabase.functions.invoke("get-media-signed-url", {
        body: { asset_id: item.id },
      });
      if (error) return null;
      return (data as any)?.thumbnail_url ?? null;
    },
    enabled: !!item.thumbnail_path,
    staleTime: 45_000,
  });

  return (
    <button
      onClick={onOpen}
      className="group text-left border border-mk-line rounded-lg overflow-hidden bg-white hover:border-mk-blue hover:shadow-sm transition-all flex flex-col"
    >
      <div className="aspect-[4/3] bg-mk-alt flex items-center justify-center relative overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" loading="lazy" />
        ) : (
          <Icon size={32} className="text-mk-ter" />
        )}
        <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-mk-navy px-1.5 py-0.5 rounded">
          {TYPE_LABEL[item.asset_type]}
        </span>
        {isVideo && item.duration_seconds && (
          <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
            {Math.floor(item.duration_seconds / 60)}:{String(item.duration_seconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <div className="text-sm font-semibold text-mk-navy line-clamp-2">{item.title}</div>
        <div className="text-[11px] text-mk-sec flex items-center gap-1.5 mt-auto">
          <span className="uppercase">{item.language}</span>
          {item.page_count ? <span>· {item.page_count} p.</span> : null}
          {item.file_size_bytes ? <span>· {formatSize(item.file_size_bytes)}</span> : null}
        </div>
      </div>
    </button>
  );
}

function MediaLightbox({
  items,
  index,
  onClose,
  onNav,
}: {
  items: MediaItem[];
  index: number | null;
  onClose: () => void;
  onNav: (delta: number) => void;
}) {
  const open = index !== null;
  const item = index !== null ? items[index] : null;

  const { data: signed, isLoading } = useQuery({
    queryKey: ["media-signed", item?.id],
    enabled: !!item,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-media-signed-url", {
        body: { asset_id: item!.id },
      });
      if (error) throw error;
      return data as { url: string; thumbnail_url?: string | null };
    },
    staleTime: 45_000,
  });

  const url = signed?.url ?? null;
  const mime = item?.mime_type ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNav(1);
      else if (e.key === "ArrowLeft") onNav(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNav]);

  const [copied, setCopied] = useState(false);

  async function handleDownload() {
    if (!url || !item) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      const ext = (item.file_path.split(".").pop() || "bin").toLowerCase();
      a.download = `${item.title.replace(/[^\w\-]+/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleShare() {
    if (!url || !item) return;
    const shareData = { title: item.title, text: item.description || item.title, url };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {/* fallback */}
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Lien copié", description: "Le lien de partage a été copié dans le presse-papier." });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Partage indisponible", description: "Impossible de copier le lien." });
    }
  }

  const content = useMemo(() => {
    if (!item) return null;
    if (isLoading || !url) {
      return (
        <div className="flex items-center justify-center h-[60vh] text-white/80">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    if (isImageMime(mime)) {
      return <img src={url} alt={item.title} className="max-h-[80vh] max-w-full object-contain mx-auto" />;
    }
    if (isVideoMime(mime)) {
      return <video src={url} controls className="max-h-[80vh] max-w-full mx-auto bg-black" />;
    }
    if (isPdfMime(mime)) {
      return <iframe src={url} title={item.title} className="w-full h-[80vh] bg-white rounded" />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] gap-3 text-white">
        <FileText size={48} className="opacity-70" />
        <p className="text-sm opacity-80">Aperçu non disponible pour ce format.</p>
        <button onClick={handleDownload} className="px-4 py-2 rounded bg-white text-mk-navy text-sm font-medium inline-flex items-center gap-2">
          <Download size={14} /> Télécharger
        </button>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, url, isLoading, mime]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl p-0 bg-mk-navy border-none overflow-hidden">
        {item && (
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3 p-4 text-white">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide opacity-70">{TYPE_LABEL[item.asset_type]} · {item.language}</div>
                <h3 className="text-base md:text-lg font-bold truncate">{item.title}</h3>
                {item.description && <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{item.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleShare} className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md">
                  {copied ? <Check size={13} /> : <Share2 size={13} />} {copied ? "Copié" : "Partager"}
                </button>
                <button onClick={handleDownload} className="inline-flex items-center gap-1.5 text-xs bg-white text-mk-navy px-3 py-1.5 rounded-md font-medium hover:bg-white/90">
                  <Download size={13} /> Télécharger
                </button>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10" aria-label="Fermer">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="relative bg-black/60 px-2 pb-3">
              {items.length > 1 && (
                <>
                  <button
                    onClick={() => onNav(-1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    aria-label="Précédent"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => onNav(1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                    aria-label="Suivant"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              <div className="min-h-[40vh] flex items-center justify-center">{content}</div>
              {items.length > 1 && (
                <div className="text-center text-[11px] text-white/60 mt-2">
                  {(index ?? 0) + 1} / {items.length}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
