import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, FileCheck2, FileText } from "lucide-react";
import {
  ContractTemplatePreview,
  type PreviewArticle,
  type PreviewMedikong,
  type PreviewParagraph,
} from "@/components/admin/contract-template/ContractTemplatePreview";

const CONTRACT_TYPE = "mandat_facturation";

interface ContractTemplateRow {
  id: string;
  contract_type: string;
  version: string;
  status: "draft" | "published" | "archived";
  effective_at: string | null;
  medikong_data: PreviewMedikong;
  articles: PreviewArticle[];
  required_fields: Array<{ key: string; label: string }>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminContractTemplate() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  // Liste des versions
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["contract-templates", CONTRACT_TYPE],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contract_templates")
        .select("*")
        .eq("contract_type", CONTRACT_TYPE)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractTemplateRow[];
    },
  });

  // Sélection par défaut : draft le plus récent, sinon published
  useEffect(() => {
    if (!selectedId && versions.length > 0) {
      const draft = versions.find((v) => v.status === "draft");
      setSelectedId((draft ?? versions[0]).id);
    }
  }, [versions, selectedId]);

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? null,
    [versions, selectedId]
  );

  // Form state (sync sur selected)
  const [medikong, setMedikong] = useState<PreviewMedikong>({});
  const [articles, setArticles] = useState<PreviewArticle[]>([]);
  const [requiredFields, setRequiredFields] = useState<Array<{ key: string; label: string }>>([]);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (selected) {
      setMedikong(selected.medikong_data ?? {});
      setArticles(selected.articles ?? []);
      setRequiredFields(selected.required_fields ?? []);
      setNotes(selected.notes ?? "");
    }
  }, [selected]);

  const isDraft = selected?.status === "draft";
  const isPublished = selected?.status === "published";

  // --- Mutations ---
  const bumpMutation = useMutation({
    mutationFn: async (newVersion: string) => {
      const { data, error } = await (supabase as any).rpc("bump_contract_template", {
        _type: CONTRACT_TYPE,
        _new_version: newVersion,
        _notes: null,
      });
      if (error) throw error;
      return data as ContractTemplateRow;
    },
    onSuccess: (row) => {
      toast.success(`Brouillon ${row.version} créé`);
      qc.invalidateQueries({ queryKey: ["contract-templates", CONTRACT_TYPE] });
      setSelectedId(row.id);
      setActiveTab("editor");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur lors du bump"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Aucune version sélectionnée");
      const { data, error } = await (supabase as any).rpc("update_contract_template_draft", {
        _id: selected.id,
        _medikong_data: medikong,
        _articles: articles,
        _required_fields: requiredFields,
        _notes: notes || null,
      });
      if (error) throw error;
      return data as ContractTemplateRow;
    },
    onSuccess: () => {
      toast.success("Brouillon enregistré");
      qc.invalidateQueries({ queryKey: ["contract-templates", CONTRACT_TYPE] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur d'enregistrement"),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Aucune version sélectionnée");
      const { data, error } = await (supabase as any).rpc("publish_contract_template", {
        _id: selected.id,
        _effective_at: new Date().toISOString(),
      });
      if (error) throw error;
      return data as ContractTemplateRow;
    },
    onSuccess: () => {
      toast.success("Version publiée");
      qc.invalidateQueries({ queryKey: ["contract-templates", CONTRACT_TYPE] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur de publication"),
  });

  // --- Handlers article/paragraphe ---
  const updateArticle = (idx: number, patch: Partial<PreviewArticle>) => {
    setArticles((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };
  const moveArticle = (idx: number, dir: -1 | 1) => {
    setArticles((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const removeArticle = (idx: number) => {
    setArticles((prev) => prev.filter((_, i) => i !== idx));
  };
  const addArticle = () => {
    setArticles((prev) => [
      ...prev,
      {
        id: `art-${Date.now()}`,
        number: String(prev.length + 1),
        title: "Nouvel article",
        paragraphs: [""],
      },
    ]);
  };
  const updateParagraph = (artIdx: number, parIdx: number, value: PreviewParagraph) => {
    setArticles((prev) =>
      prev.map((a, i) =>
        i === artIdx
          ? { ...a, paragraphs: a.paragraphs.map((p, j) => (j === parIdx ? value : p)) }
          : a
      )
    );
  };
  const addParagraph = (artIdx: number, kind: "text" | "list" | "subarticle") => {
    const newPar: PreviewParagraph =
      kind === "text"
        ? ""
        : kind === "list"
        ? { type: "list", items: [""] }
        : { type: "subarticle", number: "x.y", text: "" };
    setArticles((prev) =>
      prev.map((a, i) => (i === artIdx ? { ...a, paragraphs: [...a.paragraphs, newPar] } : a))
    );
  };
  const removeParagraph = (artIdx: number, parIdx: number) => {
    setArticles((prev) =>
      prev.map((a, i) =>
        i === artIdx ? { ...a, paragraphs: a.paragraphs.filter((_, j) => j !== parIdx) } : a
      )
    );
  };

  // --- Render ---
  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contrat vendeur — Mandat de facturation</h1>
          <p className="text-sm text-muted-foreground">
            Édite le contenu, crée une nouvelle version, et publie-la. Les vendeurs déjà signés restent
            sur leur version d'origine.
          </p>
        </div>
        <NewVersionDialog
          onConfirm={(v) => bumpMutation.mutate(v)}
          pending={bumpMutation.isPending}
          versions={versions.map((v) => v.version)}
        />
      </header>

      {/* Sélecteur version */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v)}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Choisir une version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.version} — {labelStatus(v.status)}
                    {v.effective_at && ` · effectif ${new Date(v.effective_at).toLocaleDateString("fr-BE")}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && <StatusBadge status={selected.status} />}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="editor">
              <FileText className="w-4 h-4 mr-2" />
              Éditeur
            </TabsTrigger>
            <TabsTrigger value="preview">
              <FileCheck2 className="w-4 h-4 mr-2" />
              Aperçu
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4 mt-4">
            {!isDraft && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Cette version est en statut <strong>{labelStatus(selected.status)}</strong>. Pour
                modifier, crée une nouvelle version (brouillon) via le bouton « Nouvelle version ».
              </div>
            )}

            {/* Coordonnées MediKong */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Coordonnées MediKong</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  [
                    ["legal_form", "Forme juridique"],
                    ["address", "Adresse"],
                    ["bce", "BCE"],
                    ["vat", "TVA"],
                    ["representative_name", "Représentant"],
                    ["representative_role", "Qualité"],
                    ["jurisdiction_city", "Juridiction"],
                  ] as Array<[keyof PreviewMedikong, string]>
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      disabled={!isDraft}
                      value={(medikong as any)[key] ?? ""}
                      onChange={(e) => setMedikong({ ...medikong, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Articles */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Articles ({articles.length})</CardTitle>
                <Button size="sm" variant="outline" disabled={!isDraft} onClick={addArticle}>
                  <Plus className="w-4 h-4 mr-1" />
                  Article
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {articles.map((article, artIdx) => (
                  <div key={article.id} className="rounded-md border p-3 space-y-3 bg-muted/30">
                    <div className="flex items-start gap-2">
                      <Input
                        disabled={!isDraft}
                        className="w-20"
                        value={article.number}
                        onChange={(e) => updateArticle(artIdx, { number: e.target.value })}
                        placeholder="N°"
                      />
                      <Input
                        disabled={!isDraft}
                        className="flex-1"
                        value={article.title}
                        onChange={(e) => updateArticle(artIdx, { title: e.target.value })}
                        placeholder="Titre"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!isDraft}
                        onClick={() => moveArticle(artIdx, -1)}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!isDraft}
                        onClick={() => moveArticle(artIdx, 1)}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!isDraft}
                        onClick={() => removeArticle(artIdx)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-2 pl-2">
                      {article.paragraphs.map((p, parIdx) => (
                        <ParagraphEditor
                          key={parIdx}
                          paragraph={p}
                          disabled={!isDraft}
                          onChange={(v) => updateParagraph(artIdx, parIdx, v)}
                          onRemove={() => removeParagraph(artIdx, parIdx)}
                        />
                      ))}
                      {isDraft && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={() => addParagraph(artIdx, "text")}>
                            + Texte
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addParagraph(artIdx, "list")}>
                            + Liste
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addParagraph(artIdx, "subarticle")}
                          >
                            + Sous-article
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Champs requis */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Champs vendeur requis pour signature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {requiredFields.map((f, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      disabled={!isDraft}
                      className="w-1/3"
                      value={f.key}
                      onChange={(e) =>
                        setRequiredFields((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r))
                        )
                      }
                      placeholder="clé"
                    />
                    <Input
                      disabled={!isDraft}
                      className="flex-1"
                      value={f.label}
                      onChange={(e) =>
                        setRequiredFields((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r))
                        )
                      }
                      placeholder="Libellé"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!isDraft}
                      onClick={() =>
                        setRequiredFields((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {isDraft && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRequiredFields((prev) => [...prev, { key: "", label: "" }])
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Champ
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes de version (interne)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  disabled={!isDraft}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: ajout clause Peppol, MAJ commission…"
                />
              </CardContent>
            </Card>

            {/* Actions */}
            {isDraft && (
              <div className="flex flex-wrap gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-md border">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
                <PublishDialog
                  version={selected.version}
                  pending={publishMutation.isPending}
                  onConfirm={() => publishMutation.mutate()}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <ContractTemplatePreview
                  medikong={medikong}
                  articles={articles}
                  version={selected.version}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function labelStatus(s: string) {
  return s === "draft" ? "Brouillon" : s === "published" ? "Publiée" : "Archivée";
}

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, string> = {
    draft: "bg-amber-100 text-amber-900",
    published: "bg-emerald-100 text-emerald-900",
    archived: "bg-slate-100 text-slate-700",
  };
  return <Badge className={variant[status] ?? ""}>{labelStatus(status)}</Badge>;
}

function NewVersionDialog({
  onConfirm,
  pending,
  versions,
}: {
  onConfirm: (v: string) => void;
  pending: boolean;
  versions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle version (brouillon)
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Créer un nouveau brouillon</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action clone la version publiée actuelle en brouillon éditable. Tu pourras le publier
            ensuite. Format suggéré : <code>v1.1</code>, <code>v2.0</code>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label>Numéro de version</Label>
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="v1.1"
          />
          {versions.includes(val) && (
            <p className="text-xs text-destructive">Cette version existe déjà.</p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={!val || versions.includes(val) || pending}
            onClick={() => {
              onConfirm(val.trim());
              setVal("");
              setOpen(false);
            }}
          >
            Créer brouillon
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PublishDialog({
  version,
  pending,
  onConfirm,
}: {
  version: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700">
          <FileCheck2 className="w-4 h-4 mr-2" />
          Publier
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publier la version {version} ?</AlertDialogTitle>
          <AlertDialogDescription>
            La version actuellement publiée sera archivée. La nouvelle version s'appliquera à toute
            signature future. Les vendeurs déjà signés ne sont pas migrés automatiquement (article 10
            — préavis 30 jours à organiser séparément).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            Publier maintenant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ParagraphEditor({
  paragraph,
  disabled,
  onChange,
  onRemove,
}: {
  paragraph: PreviewParagraph;
  disabled: boolean;
  onChange: (v: PreviewParagraph) => void;
  onRemove: () => void;
}) {
  if (typeof paragraph === "string") {
    return (
      <div className="flex gap-2 items-start">
        <Textarea
          disabled={disabled}
          rows={2}
          value={paragraph}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm"
        />
        <Button size="icon" variant="ghost" disabled={disabled} onClick={onRemove}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    );
  }
  if (paragraph.type === "list") {
    return (
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-1">
          <div className="text-xs text-muted-foreground">Liste à puces (une ligne par puce)</div>
          <Textarea
            disabled={disabled}
            rows={Math.max(3, paragraph.items.length)}
            value={paragraph.items.join("\n")}
            onChange={(e) =>
              onChange({ type: "list", items: e.target.value.split("\n") })
            }
            className="text-sm"
          />
        </div>
        <Button size="icon" variant="ghost" disabled={disabled} onClick={onRemove}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    );
  }
  // subarticle
  return (
    <div className="flex gap-2 items-start">
      <Input
        disabled={disabled}
        className="w-20"
        value={paragraph.number}
        onChange={(e) => onChange({ ...paragraph, number: e.target.value })}
        placeholder="4.1"
      />
      <Textarea
        disabled={disabled}
        rows={2}
        value={paragraph.text}
        onChange={(e) => onChange({ ...paragraph, text: e.target.value })}
        className="flex-1 text-sm"
      />
      <Button size="icon" variant="ghost" disabled={disabled} onClick={onRemove}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}
