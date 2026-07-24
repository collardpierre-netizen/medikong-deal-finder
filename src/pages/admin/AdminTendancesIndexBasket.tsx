import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Play, Trash2, Plus, Loader2 } from "lucide-react";

type BasketRow = {
  product_id: string;
  priority: number;
  is_active: boolean;
  reason: string | null;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
  last_scrape_error: string | null;
  updated_at: string;
  products: { name: string | null; gtin: string | null; qogita_slug: string | null } | null;
};

type ScrapeLog = {
  id: number;
  started_at: string;
  ended_at: string | null;
  products_targeted: number | null;
  products_ok: number | null;
  products_404: number | null;
  products_error: number | null;
  points_upserted: number | null;
  offers_resourced: number | null;
  notes: string | null;
  errors: unknown;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminTendancesIndexBasket() {
  const qc = useQueryClient();
  const [gtinInput, setGtinInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [priorityInput, setPriorityInput] = useState("100");
  const [batchLimit, setBatchLimit] = useState("20");
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState(false);

  const basketQuery = useQuery({
    queryKey: ["tendances-basket"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tendances_index_basket")
        .select("product_id, priority, is_active, reason, last_scraped_at, last_scrape_status, last_scrape_error, updated_at, products:product_id(name, gtin, qogita_slug)")
        .order("priority", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BasketRow[];
    },
  });

  const logsQuery = useQuery({
    queryKey: ["qogita-scrape-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qogita_price_scrape_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ScrapeLog[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const gtin = gtinInput.trim();
      if (!gtin) throw new Error("GTIN requis");
      const { data: prod, error: pErr } = await supabase
        .from("products")
        .select("id, name")
        .eq("gtin", gtin)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prod) throw new Error(`Aucun produit trouvé avec GTIN ${gtin}`);
      const { error } = await supabase.from("tendances_index_basket").upsert({
        product_id: prod.id,
        priority: parseInt(priorityInput, 10) || 100,
        reason: reasonInput.trim() || null,
        is_active: true,
      }, { onConflict: "product_id" });
      if (error) throw error;
      return prod.name;
    },
    onSuccess: (name) => {
      toast.success(`Ajouté au panier : ${name}`);
      setGtinInput("");
      setReasonInput("");
      qc.invalidateQueries({ queryKey: ["tendances-basket"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ product_id, patch }: { product_id: string; patch: { priority?: number; is_active?: boolean; reason?: string | null } }) => {
      const { error } = await supabase.from("tendances_index_basket").update(patch).eq("product_id", product_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tendances-basket"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (product_id: string) => {
      const { error } = await supabase.from("tendances_index_basket").delete().eq("product_id", product_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Retiré du panier");
      qc.invalidateQueries({ queryKey: ["tendances-basket"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runScrape(scope: "basket" | "single", singleProductId?: string) {
    setRunning(true);
    try {
      const body: Record<string, unknown> = {
        limit: Math.min(Math.max(parseInt(batchLimit, 10) || 20, 1), 100),
        dryRun,
      };
      if (scope === "single" && singleProductId) body.productIds = [singleProductId];
      const { data, error } = await supabase.functions.invoke("scrape-qogita-storefront", { body });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; message?: string; stats?: Record<string, number> };
      if (payload?.error) throw new Error(payload.error);
      const s = payload?.stats;
      toast.success(s
        ? `Scrape OK — ok:${s.ok ?? 0} · 404:${s["404"] ?? 0} · err:${s.error ?? 0} · points:${s.points_upserted ?? 0}`
        : payload?.message ?? "Scrape lancé");
      qc.invalidateQueries({ queryKey: ["tendances-basket"] });
      qc.invalidateQueries({ queryKey: ["qogita-scrape-logs"] });
    } catch (e) {
      toast.error(`Échec scrape : ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Panier d'indice Tendances</h1>
        <p className="text-sm text-muted-foreground">
          Produits suivis par le scraper Qogita storefront (offres multi-vendeurs + historique de prix).
        </p>
      </div>

      <Tabs defaultValue="basket">
        <TabsList>
          <TabsTrigger value="basket">Panier ({basketQuery.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="backfill">Backfill manuel</TabsTrigger>
          <TabsTrigger value="history">Historique ({logsQuery.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="basket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Ajouter un produit</CardTitle>
              <CardDescription>Recherche par GTIN — le produit doit exister en base.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_120px_1fr_auto]">
              <div>
                <Label>GTIN</Label>
                <Input value={gtinInput} onChange={(e) => setGtinInput(e.target.value)} placeholder="3701129812105" />
              </div>
              <div>
                <Label>Priorité</Label>
                <Input type="number" value={priorityInput} onChange={(e) => setPriorityInput(e.target.value)} />
              </div>
              <div>
                <Label>Raison (optionnel)</Label>
                <Input value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} placeholder="Top vente Q3" />
              </div>
              <div className="flex items-end">
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Produits suivis</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => basketQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir
              </Button>
            </CardHeader>
            <CardContent>
              {basketQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Chargement…</div>
              ) : (basketQuery.data?.length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun produit dans le panier.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>GTIN</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Actif</TableHead>
                      <TableHead>Dernier scrape</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Raison</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {basketQuery.data!.map((r) => (
                      <TableRow key={r.product_id}>
                        <TableCell className="max-w-[240px] truncate" title={r.products?.name ?? ""}>{r.products?.name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.products?.gtin ?? "—"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            defaultValue={r.priority}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!Number.isNaN(v) && v !== r.priority) {
                                updateMutation.mutate({ product_id: r.product_id, patch: { priority: v } });
                              }
                            }}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={r.is_active}
                            onCheckedChange={(v) => updateMutation.mutate({ product_id: r.product_id, patch: { is_active: v } })}
                          />
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(r.last_scraped_at)}</TableCell>
                        <TableCell>
                          {r.last_scrape_status === "ok" && <Badge variant="secondary">OK</Badge>}
                          {r.last_scrape_status === "error" && <Badge variant="destructive" title={r.last_scrape_error ?? ""}>Erreur</Badge>}
                          {r.last_scrape_status === "404" && <Badge variant="outline">404</Badge>}
                          {!r.last_scrape_status && <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => runScrape("single", r.product_id)} disabled={running}>
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (confirm(`Retirer ${r.products?.name ?? r.product_id} du panier ?`)) deleteMutation.mutate(r.product_id);
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backfill" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lancer un scrape manuel</CardTitle>
              <CardDescription>
                Sans cible spécifique, pioche dans le panier (les plus anciens en priorité).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[160px_auto_1fr]">
                <div>
                  <Label>Limite (1-100)</Label>
                  <Input type="number" min={1} max={100} value={batchLimit} onChange={(e) => setBatchLimit(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch id="dry" checked={dryRun} onCheckedChange={setDryRun} />
                  <Label htmlFor="dry" className="pb-2">Dry run (aucune écriture)</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => runScrape("basket")} disabled={running}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Lancer sur le panier
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Le cron quotidien tourne à 03:30 UTC et traite 20 produits par run.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Historique d'exécution</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => logsQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir
              </Button>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Chargement…</div>
              ) : (logsQuery.data?.length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">Aucun run enregistré.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Démarré</TableHead>
                      <TableHead>Terminé</TableHead>
                      <TableHead>Cible</TableHead>
                      <TableHead>OK</TableHead>
                      <TableHead>404</TableHead>
                      <TableHead>Erreurs</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Offres re-src</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsQuery.data!.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{fmtDate(l.started_at)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(l.ended_at)}</TableCell>
                        <TableCell>{l.products_targeted ?? 0}</TableCell>
                        <TableCell><Badge variant="secondary">{l.products_ok ?? 0}</Badge></TableCell>
                        <TableCell>{l.products_404 ?? 0}</TableCell>
                        <TableCell>{(l.products_error ?? 0) > 0 ? <Badge variant="destructive">{l.products_error}</Badge> : 0}</TableCell>
                        <TableCell>{l.points_upserted ?? 0}</TableCell>
                        <TableCell>{l.offers_resourced ?? 0}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={l.notes ?? ""}>{l.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
