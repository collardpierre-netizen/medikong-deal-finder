// Reusable media picker for attaching library items to entities (product/brand/offer/cms).
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type MediaEntityType = "product" | "brand" | "offer" | "cms";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: MediaEntityType;
  entityId: string;
  role?: string;
  multiple?: boolean;
  onAttached?: (mediaIds: string[]) => void;
}

export function MediaLibraryPicker({
  open,
  onOpenChange,
  entityType,
  entityId,
  role = "gallery",
  multiple = true,
  onAttached,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const listQ = useQuery({
    queryKey: ["media-picker-list", search, open],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("media_library")
        .select("id, filename, title, alt_text, folder, tags, width, height, mime_type")
        .order("created_at", { ascending: false })
        .limit(60);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`title.ilike.${s},filename.ilike.${s},alt_text.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const rows = listQ.data ?? [];
    const missing = rows.filter((r: any) => !urls[r.id]).map((r: any) => r.id);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase.functions.invoke("media-library-signed-url", {
        body: { media_ids: missing },
      });
      if (data?.urls) setUrls((prev) => ({ ...prev, ...data.urls }));
    })();
  }, [listQ.data, urls]);

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else {
        if (!multiple) n.clear();
        n.add(id);
      }
      return n;
    });
  };

  const attach = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    const rows = Array.from(selected).map((mid, i) => ({
      media_id: mid,
      entity_type: entityType,
      entity_id: entityId,
      role,
      sort_order: i,
    }));
    const { error } = await supabase.from("media_library_links").upsert(rows as any, {
      onConflict: "media_id,entity_type,entity_id,role",
      ignoreDuplicates: false,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selected.size} média(s) rattaché(s)` });
    onAttached?.(Array.from(selected));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choisir dans la bibliothèque média</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un média…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {listQ.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Chargement…
          </div>
        ) : (listQ.data ?? []).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Aucun média. Uploadez-en depuis /admin/media-library.
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto">
            {(listQ.data ?? []).map((m: any) => {
              const isSel = selected.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`relative aspect-square rounded border-2 overflow-hidden transition ${
                    isSel ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-muted-foreground/50"
                  }`}
                >
                  {urls[m.id] ? (
                    <img src={urls[m.id]} alt={m.alt_text ?? m.title ?? m.filename} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                    {m.title ?? m.filename}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <div className="text-sm text-muted-foreground mr-auto">{selected.size} sélectionné(s)</div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={attach} disabled={selected.size === 0 || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rattacher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
