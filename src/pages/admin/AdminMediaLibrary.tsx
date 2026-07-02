import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Search, Copy, Pencil, ImageIcon } from "lucide-react";

type MediaRow = {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  title: string | null;
  alt_text: string | null;
  description: string | null;
  folder: string;
  tags: string[];
  created_at: string;
};

const PAGE_SIZE = 60;

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

export default function AdminMediaLibrary() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const folders = useQuery({
    queryKey: ["media-library-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_library").select("folder");
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => set.add(r.folder));
      return Array.from(set).sort();
    },
  });

  const listQ = useQuery({
    queryKey: ["media-library-list", search, folder, tagFilter],
    queryFn: async () => {
      let q = supabase
        .from("media_library")
        .select(
          "id, storage_path, filename, mime_type, size_bytes, width, height, sha256, title, alt_text, description, folder, tags, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (folder !== "all") q = q.eq("folder", folder);
      if (tagFilter.trim()) q = q.contains("tags", [tagFilter.trim()]);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`title.ilike.${s},filename.ilike.${s},alt_text.ilike.${s},description.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    },
  });

  // Signed URLs
  useEffect(() => {
    const rows = listQ.data ?? [];
    const missing = rows.filter((r) => !urls[r.id]).map((r) => r.id);
    if (missing.length === 0) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("media-library-signed-url", {
        body: { media_ids: missing },
      });
      if (error || !data?.urls) return;
      setUrls((prev) => ({ ...prev, ...data.urls }));
    })();
  }, [listQ.data, urls]);

  const doUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      let ok = 0;
      let dup = 0;
      let fail = 0;
      for (const f of list) {
        const form = new FormData();
        form.append("file", f);
        form.append("folder", folder === "all" ? "general" : folder);
        const { data, error } = await supabase.functions.invoke("media-library-upload", { body: form });
        if (error || !data?.ok) {
          fail++;
        } else if (data.duplicate) {
          dup++;
        } else {
          ok++;
        }
      }
      setUploading(false);
      toast({
        title: "Upload terminé",
        description: `${ok} ajouté(s), ${dup} doublon(s) ignoré(s), ${fail} échec(s).`,
        variant: fail > 0 ? "destructive" : "default",
      });
      qc.invalidateQueries({ queryKey: ["media-library-list"] });
      qc.invalidateQueries({ queryKey: ["media-library-folders"] });
    },
    [folder, qc],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) doUpload(e.dataTransfer.files);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement ce média ? Les rattachements seront aussi supprimés.")) return;
    const { data, error } = await supabase.functions.invoke("media-library-delete", { body: { media_id: id } });
    if (error || !data?.ok) {
      toast({ title: "Erreur", description: error?.message || "Échec suppression", variant: "destructive" });
      return;
    }
    toast({ title: "Média supprimé" });
    setUrls((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    qc.invalidateQueries({ queryKey: ["media-library-list"] });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("media_library")
      .update({
        title: editing.title,
        alt_text: editing.alt_text,
        description: editing.description,
        folder: editing.folder,
        tags: editing.tags,
      })
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Média mis à jour" });
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["media-library-list"] });
    qc.invalidateQueries({ queryKey: ["media-library-folders"] });
  };

  const copyUrl = async (id: string) => {
    const url = urls[id];
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast({ title: "URL signée copiée (valide 10 min)" });
  };

  const totalCount = listQ.data?.length ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bibliothèque média</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Photothèque centrale — réutilisable sur produits, marques, offres et pages CMS.
          </p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Uploader
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            if (e.target.files) doUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Titre, nom de fichier, alt, description…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Dossier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les dossiers</SelectItem>
              {(folders.data ?? []).map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Filtre par tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
        </CardContent>
      </Card>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center text-sm ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
      >
        Glisser-déposer des fichiers ici pour uploader dans « {folder === "all" ? "general" : folder} »
      </div>

      {listQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Chargement…
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Aucun média trouvé.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {(listQ.data ?? []).map((m) => (
            <Card key={m.id} className="overflow-hidden group">
              <div className="aspect-square bg-muted relative">
                {urls[m.id] ? (
                  <img src={urls[m.id]} alt={m.alt_text ?? m.title ?? m.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => setEditing(m)} title="Modifier">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => copyUrl(m.id)} title="Copier URL signée">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => remove(m.id)} title="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-2 text-xs space-y-1">
                <div className="font-medium truncate" title={m.title ?? m.filename}>
                  {m.title ?? m.filename}
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{m.width && m.height ? `${m.width}×${m.height}` : "—"}</span>
                  <span>{formatBytes(m.size_bytes)}</span>
                </div>
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le média</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {urls[editing.id] && (
                <img src={urls[editing.id]} alt="" className="w-full max-h-64 object-contain rounded border" />
              )}
              <div>
                <Label>Titre</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Texte alternatif (SEO / accessibilité)</Label>
                <Input
                  value={editing.alt_text ?? ""}
                  onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dossier</Label>
                  <Input
                    value={editing.folder}
                    onChange={(e) => setEditing({ ...editing, folder: e.target.value.replace(/[^\w.\-]/g, "_") })}
                  />
                </div>
                <div>
                  <Label>Tags (séparés par virgules)</Label>
                  <Input
                    value={editing.tags.join(", ")}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {editing.filename} · {editing.mime_type} · {formatBytes(editing.size_bytes)}
                {editing.width && editing.height ? ` · ${editing.width}×${editing.height}` : ""}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
