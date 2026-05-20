import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, ExternalLink, RefreshCw } from "lucide-react";

const ASSET_TYPES = ["catalogue", "affiche", "video", "fiche", "brochure"] as const;
const LANGS = ["fr", "nl", "en", "de"] as const;
const VISIBILITY = ["public", "authenticated", "premium"] as const;
const SEASONS = [
  { value: "", label: "Aucune" },
  { value: "hiver", label: "Hiver" },
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Été" },
  { value: "automne", label: "Automne" },
];

type Owner = { kind: "brand" | "manufacturer"; id: string; name: string };

export default function AdminMedia() {
  const qc = useQueryClient();
  const [ownerFilter, setOwnerFilter] = useState<Owner | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: brands } = useQuery({
    queryKey: ["admin-media-brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("id, name").order("name").limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: manufacturers } = useQuery({
    queryKey: ["admin-media-mfrs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manufacturers").select("id, name").order("name").limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["admin-media-assets", ownerFilter, typeFilter, langFilter],
    queryFn: async () => {
      let q = supabase
        .from("media_assets")
        .select("*, brands(name), manufacturers(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (ownerFilter?.kind === "brand") q = q.eq("brand_id", ownerFilter.id);
      if (ownerFilter?.kind === "manufacturer") q = q.eq("manufacturer_id", ownerFilter.id);
      if (typeFilter !== "all") q = q.eq("asset_type", typeFilter as any);
      if (langFilter !== "all") q = q.eq("language", langFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return assetsQuery.data ?? [];
    const s = search.toLowerCase();
    return (assetsQuery.data ?? []).filter(
      (a: any) =>
        a.title?.toLowerCase().includes(s) ||
        a.description?.toLowerCase().includes(s) ||
        (a.tags ?? []).some((t: string) => t.toLowerCase().includes(s)),
    );
  }, [assetsQuery.data, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Médias marques & fabricants</h1>
          <p className="text-sm text-muted-foreground">Upload, validation et organisation des assets PLV.</p>
        </div>
        <Button variant="outline" onClick={() => assetsQuery.refetch()} disabled={assetsQuery.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${assetsQuery.isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <UploadCard
        brands={brands ?? []}
        manufacturers={manufacturers ?? []}
        onUploaded={() => qc.invalidateQueries({ queryKey: ["admin-media-assets"] })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <Label>Marque / Fabricant</Label>
            <OwnerPicker
              brands={brands ?? []}
              manufacturers={manufacturers ?? []}
              value={ownerFilter}
              onChange={setOwnerFilter}
              allowEmpty
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Langue</Label>
            <Select value={langFilter} onValueChange={setLangFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recherche</Label>
            <Input placeholder="titre, tag…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Assets ({filtered.length}{assetsQuery.data && filtered.length !== assetsQuery.data.length ? `/${assetsQuery.data.length}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assetsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun média.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aperçu</TableHead>
                  <TableHead>Titre / Cible</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Tags / saison</TableHead>
                  <TableHead className="w-[80px]">Tri</TableHead>
                  <TableHead className="w-[80px]">Actif</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a: any) => (
                  <AssetRow key={a.id} asset={a} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-media-assets"] })} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------- Upload card ------------------------- */

function UploadCard({
  brands,
  manufacturers,
  onUploaded,
}: {
  brands: { id: string; name: string }[];
  manufacturers: { id: string; name: string }[];
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [assetType, setAssetType] = useState<string>("affiche");
  const [language, setLanguage] = useState<string>("fr");
  const [visibility, setVisibility] = useState<string>("authenticated");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [season, setSeason] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [duration, setDuration] = useState<string>("");
  const [pageCount, setPageCount] = useState<string>("");

  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = () => {
    if (fileRef.current) fileRef.current.value = "";
    if (thumbRef.current) thumbRef.current.value = "";
    setTitle("");
    setDescription("");
    setTagsRaw("");
    setSeason("");
    setSortOrder(0);
    setDuration("");
    setPageCount("");
    setProgress(0);
    setStatus("idle");
    setErrorMsg(null);
  };

  const handleUpload = async () => {
    setErrorMsg(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setErrorMsg("Sélectionne un fichier.");
    if (!title.trim()) return setErrorMsg("Le titre est requis.");
    if (!owner) return setErrorMsg("Choisis une marque ou un fabricant.");

    const allTags = [
      ...tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      ...(season ? [season] : []),
    ];

    const form = new FormData();
    form.append("file", file);
    const thumb = thumbRef.current?.files?.[0];
    if (thumb) form.append("thumbnail", thumb);
    if (owner.kind === "brand") form.append("brand_id", owner.id);
    else form.append("manufacturer_id", owner.id);
    form.append("asset_type", assetType);
    form.append("language", language);
    form.append("visibility", visibility);
    form.append("title", title.trim());
    if (description.trim()) form.append("description", description.trim());
    form.append("tags", allTags.join(","));
    form.append("sort_order", String(sortOrder));
    if (duration) form.append("duration_seconds", duration);
    if (pageCount) form.append("page_count", pageCount);

    // Use XHR for real upload progress
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setErrorMsg("Session expirée, reconnecte-toi.");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media-asset`;

    setStatus("uploading");
    setProgress(0);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
            if (pct >= 100) setStatus("processing");
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = `HTTP ${xhr.status}`;
            try { msg = JSON.parse(xhr.responseText)?.error ?? msg; } catch {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("Réseau indisponible"));
        xhr.send(form);
      });
      setStatus("done");
      setProgress(100);
      toast({ title: "Asset uploadé", description: title });
      onUploaded();
      setTimeout(reset, 800);
    } catch (e) {
      setStatus("error");
      setErrorMsg((e as Error).message);
      toast({ title: "Échec upload", description: (e as Error).message, variant: "destructive" });
    }
  };

  const busy = status === "uploading" || status === "processing";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Nouvel asset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Cible (marque ou fabricant)*</Label>
            <OwnerPicker brands={brands} manufacturers={manufacturers} value={owner} onChange={setOwner} />
          </div>
          <div>
            <Label>Titre*</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Type d'asset*</Label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Langue</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visibilité</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBILITY.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Saison</Label>
            <Select value={season || "_none_"} onValueChange={(v) => setSeason(v === "_none_" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Aucune</SelectItem>
                {SEASONS.filter((s) => s.value).map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags (séparés par virgule)</Label>
            <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="ex: rentree, immunite" />
          </div>
          <div>
            <Label>Ordre de tri</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Durée (s) — vidéo</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <Label>Nb pages — PDF</Label>
            <Input type="number" value={pageCount} onChange={(e) => setPageCount(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Fichier* (image, PDF, MP4…)</Label>
            <Input ref={fileRef} type="file" />
          </div>
          <div>
            <Label>Thumbnail (obligatoire pour vidéo/PDF)</Label>
            <Input ref={thumbRef} type="file" accept="image/*" />
            <p className="text-xs text-muted-foreground mt-1">Pour les images, miniature auto 400×400.</p>
          </div>
        </div>

        {(busy || status === "done" || status === "error") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>
                {status === "uploading" && `Upload… ${progress}%`}
                {status === "processing" && "Traitement serveur (thumbnail, insertion DB)…"}
                {status === "done" && "Terminé ✓"}
                {status === "error" && "Erreur"}
              </span>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </div>
            <Progress value={status === "processing" ? 100 : progress} />
          </div>
        )}
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={reset} disabled={busy}>Réinitialiser</Button>
          <Button onClick={handleUpload} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Uploader
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------- Owner picker ------------------------- */

function OwnerPicker({
  brands,
  manufacturers,
  value,
  onChange,
  allowEmpty,
}: {
  brands: { id: string; name: string }[];
  manufacturers: { id: string; name: string }[];
  value: Owner | null;
  onChange: (v: Owner | null) => void;
  allowEmpty?: boolean;
}) {
  const current = value ? `${value.kind}:${value.id}` : "";
  return (
    <Select
      value={current || "_none_"}
      onValueChange={(v) => {
        if (v === "_none_") return onChange(null);
        const [kind, id] = v.split(":");
        const name =
          kind === "brand"
            ? brands.find((b) => b.id === id)?.name ?? ""
            : manufacturers.find((m) => m.id === id)?.name ?? "";
        onChange({ kind: kind as "brand" | "manufacturer", id, name });
      }}
    >
      <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {allowEmpty && <SelectItem value="_none_">— Toutes —</SelectItem>}
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Marques</div>
        {brands.slice(0, 500).map((b) => (
          <SelectItem key={`b-${b.id}`} value={`brand:${b.id}`}>{b.name}</SelectItem>
        ))}
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">Fabricants</div>
        {manufacturers.slice(0, 500).map((m) => (
          <SelectItem key={`m-${m.id}`} value={`manufacturer:${m.id}`}>{m.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------- Row ------------------------- */

function AssetRow({ asset, onChanged }: { asset: any; onChanged: () => void }) {
  const [sortOrder, setSortOrder] = useState<number>(asset.sort_order);
  const [tagsRaw, setTagsRaw] = useState<string>((asset.tags ?? []).join(", "));
  const [active, setActive] = useState<boolean>(asset.is_active);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = asset.thumbnail_path ?? asset.file_path;
      if (!path) return;
      const { data } = await supabase.storage.from("media-assets").createSignedUrl(path, 300);
      if (!cancelled) setThumbUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [asset.thumbnail_path, asset.file_path]);

  const tags = useMemo(
    () => tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
    [tagsRaw],
  );

  const dirty =
    sortOrder !== asset.sort_order ||
    active !== asset.is_active ||
    JSON.stringify(tags) !== JSON.stringify(asset.tags ?? []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("media_assets")
      .update({ sort_order: sortOrder, tags, is_active: active })
      .eq("id", asset.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Asset mis à jour" });
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Supprimer définitivement "${asset.title}" ?`)) return;
    const { error: dbErr } = await supabase.from("media_assets").delete().eq("id", asset.id);
    if (dbErr) {
      toast({ title: "Erreur", description: dbErr.message, variant: "destructive" });
      return;
    }
    const paths = [asset.file_path, asset.thumbnail_path].filter(Boolean);
    if (paths.length) await supabase.storage.from("media-assets").remove(paths);
    toast({ title: "Asset supprimé" });
    onChanged();
  };

  const openSigned = async () => {
    const { data, error } = await supabase.storage.from("media-assets").createSignedUrl(asset.file_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Erreur", description: error?.message ?? "URL indisponible", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const ownerName = asset.brands?.name ?? asset.manufacturers?.name ?? "—";
  const ownerKind = asset.brand_id ? "Marque" : "Fabricant";

  return (
    <TableRow>
      <TableCell>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-12 w-12 object-cover rounded border" />
        ) : (
          <div className="h-12 w-12 bg-muted rounded border" />
        )}
      </TableCell>
      <TableCell>
        <div className="font-medium text-sm">{asset.title}</div>
        <div className="text-xs text-muted-foreground">{ownerKind} · {ownerName}</div>
      </TableCell>
      <TableCell><Badge variant="secondary">{asset.asset_type}</Badge></TableCell>
      <TableCell><Badge variant="outline">{asset.language?.toUpperCase()}</Badge></TableCell>
      <TableCell className="min-w-[200px]">
        <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} className="h-8 text-xs" />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          className="h-8 w-16 text-xs"
        />
      </TableCell>
      <TableCell><Switch checked={active} onCheckedChange={setActive} /></TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={openSigned} title="Ouvrir">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={save} disabled={!dirty || saving} title="Enregistrer">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} title="Supprimer">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
