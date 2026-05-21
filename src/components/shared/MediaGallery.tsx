import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Film, ImageIcon, Download, Loader2, BookOpen, Megaphone } from "lucide-react";
import { useState } from "react";

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
        {data.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  const [opening, setOpening] = useState(false);
  const Icon = TYPE_ICON[item.asset_type];
  const isVideo = item.asset_type === "video" || item.mime_type?.startsWith("video/");

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

  async function open() {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-media-signed-url", {
        body: { asset_id: item.id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      onClick={open}
      disabled={opening}
      className="group text-left border border-mk-line rounded-lg overflow-hidden bg-white hover:border-mk-blue hover:shadow-sm transition-all flex flex-col"
    >
      <div className="aspect-[4/3] bg-mk-alt flex items-center justify-center relative overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
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
          <span className="ml-auto inline-flex items-center gap-1 text-mk-blue group-hover:underline">
            {opening ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          </span>
        </div>
      </div>
    </button>
  );
}
