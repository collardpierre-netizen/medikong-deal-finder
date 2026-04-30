import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, ExternalLink, Info } from "lucide-react";

/**
 * Admin TVA — Mapping CNK + Overrides produits
 * Permet de définir le taux TVA effectif par CNK (exact ou préfixe) et de forcer
 * un override par produit. Utilisé par la RPC resolve_product_vat_rate().
 */
export default function AdminVatRules() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"cnk" | "overrides" | "categories">("cnk");
  const [catSearch, setCatSearch] = useState("");

  // ── Audit catégories TVA
  const { data: catAudit = [], isLoading: loadingCat } = useQuery({
    queryKey: ["admin-category-vat-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_category_vat_audit" as any)
        .select("*")
        .order("was_auto_defaulted", { ascending: false })
        .order("product_count", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const updateCatVat = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("categories")
        .update({ vat_rate: rate })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-category-vat-audit"] });
      toast.success("Taux mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCat = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return catAudit;
    return catAudit.filter((c: any) =>
      (c.name || "").toLowerCase().includes(q) || (c.slug || "").toLowerCase().includes(q),
    );
  }, [catAudit, catSearch]);

  const catStats = useMemo(() => {
    const total = catAudit.length;
    const auto = catAudit.filter((c: any) => c.was_auto_defaulted).length;
    const at6 = catAudit.filter((c: any) => Number(c.vat_rate) === 6).length;
    const at21 = catAudit.filter((c: any) => Number(c.vat_rate) === 21).length;
    return { total, auto, at6, at21 };
  }, [catAudit]);

  // ── CNK mapping
  const { data: mappings = [], isLoading: loadingM } = useQuery({
    queryKey: ["cnk-vat-mapping"],
    queryFn: async () => {
      const { data } = await supabase.from("cnk_vat_mapping" as any).select("*").order("country_code").order("cnk_code", { nullsFirst: false }).order("cnk_prefix", { nullsFirst: false });
      return (data as any[]) || [];
    },
  });

  const [form, setForm] = useState({ cnk_code: "", cnk_prefix: "", vat_rate: "6", country_code: "BE", note: "" });

  const addMapping = useMutation({
    mutationFn: async () => {
      if (!form.cnk_code && !form.cnk_prefix) throw new Error("Saisir un CNK ou un préfixe");
      const { error } = await supabase.from("cnk_vat_mapping" as any).insert({
        cnk_code: form.cnk_code || null,
        cnk_prefix: form.cnk_prefix || null,
        vat_rate: Number(form.vat_rate),
        country_code: form.country_code || "BE",
        note: form.note || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Règle ajoutée");
      setForm({ cnk_code: "", cnk_prefix: "", vat_rate: "6", country_code: "BE", note: "" });
      qc.invalidateQueries({ queryKey: ["cnk-vat-mapping"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cnk_vat_mapping" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["cnk-vat-mapping"] }); },
  });

  // ── Overrides produits
  const [productSearch, setProductSearch] = useState("");
  const { data: products = [], isLoading: loadingP } = useQuery({
    queryKey: ["products-vat-overrides", productSearch],
    queryFn: async (): Promise<any[]> => {
      const base: any = supabase.from("products" as any).select("id, name, gtin, cnk_code, vat_rate_override, category_id, categories(name, vat_rate)");
      const q = productSearch.trim().length >= 2
        ? base.or(`name.ilike.%${productSearch}%,gtin.ilike.%${productSearch}%,cnk_code.ilike.%${productSearch}%`).limit(50)
        : base.not("vat_rate_override", "is", null).limit(200);
      const { data } = await q;
      return (data as any[]) || [];
    },
  });

  const setOverride = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number | null }) => {
      const { error } = await supabase.from("products").update({ vat_rate_override: rate } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Override mis à jour"); qc.invalidateQueries({ queryKey: ["products-vat-overrides"] }); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const sortedM = useMemo(() => [...mappings].sort((a, b) => (a.cnk_code || a.cnk_prefix || "").localeCompare(b.cnk_code || b.cnk_prefix || "")), [mappings]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <AdminTopBar title="Règles TVA — CNK & overrides produits" />

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Priorité de résolution du taux TVA d'un produit :
              <strong> override produit</strong> → <strong>mapping CNK exact</strong> → <strong>mapping CNK par préfixe</strong> (le plus long gagne) → <strong>vat_rate de la catégorie</strong> → fallback <strong>21%</strong>.
              Utilisé pour la conversion TTC→HTVA des offres externes (cf. <Link className="underline" to="/admin/vendeurs-externes/audit-tva">audit TVA</Link>).
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="cnk">Mapping CNK</TabsTrigger>
          <TabsTrigger value="overrides">Overrides produits</TabsTrigger>
          <TabsTrigger value="categories">
            Catégories
            {catStats.auto > 0 && (
              <Badge variant="destructive" className="ml-2 h-4 px-1.5 text-[10px]">{catStats.auto}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cnk" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Ajouter une règle</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs">CNK exact</Label>
                  <Input value={form.cnk_code} onChange={(e) => setForm({ ...form, cnk_code: e.target.value })} placeholder="3221345" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs">OU préfixe</Label>
                  <Input value={form.cnk_prefix} onChange={(e) => setForm({ ...form, cnk_prefix: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">TVA %</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}>
                    <option value="6">6%</option>
                    <option value="12">12%</option>
                    <option value="21">21%</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Pays</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })}>
                    <option value="BE">BE</option>
                    <option value="FR">FR</option>
                    <option value="LU">LU</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <Label className="text-xs">Note</Label>
                  <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ex: ONS médical" />
                </div>
                <Button onClick={() => addMapping.mutate()} disabled={addMapping.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              {loadingM ? <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p> : sortedM.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune règle. Ajoutez-en une ci-dessus.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead className="text-right">TVA</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedM.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.cnk_code ? <Badge variant="outline">CNK exact</Badge> : <Badge variant="secondary">Préfixe</Badge>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{m.cnk_code || `${m.cnk_prefix}*`}</TableCell>
                        <TableCell>{m.country_code}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{Number(m.vat_rate)}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.note || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteMapping.mutate(m.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Input placeholder="Rechercher (nom, GTIN, CNK)…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="max-w-sm" />
                <span className="text-xs text-muted-foreground">
                  {productSearch ? "Résultats de recherche" : "Produits avec override actif"}
                </span>
              </div>
              {loadingP ? <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p> : products.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {productSearch ? "Aucun produit trouvé." : "Aucun override actif."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>GTIN / CNK</TableHead>
                      <TableHead>Catégorie (TVA)</TableHead>
                      <TableHead className="text-right">Override</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[320px] truncate" title={p.name}>{p.name}</TableCell>
                        <TableCell className="text-xs tabular-nums">
                          <div>{p.gtin || "—"}</div>
                          <div className="text-muted-foreground">{p.cnk_code || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.categories?.name || "—"} {p.categories?.vat_rate != null && <span className="text-muted-foreground">({p.categories.vat_rate}%)</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            value={p.vat_rate_override ?? ""}
                            onChange={(e) => setOverride.mutate({ id: p.id, rate: e.target.value === "" ? null : Number(e.target.value) })}
                          >
                            <option value="">— aucun —</option>
                            <option value="6">6%</option>
                            <option value="12">12%</option>
                            <option value="21">21%</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <a href={`/admin/produits/${p.id}`} className="text-muted-foreground hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total catégories</div>
                  <div className="text-2xl font-semibold tabular-nums">{catStats.total}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Taux 6%</div>
                  <div className="text-2xl font-semibold tabular-nums text-emerald-600">{catStats.at6}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Taux 21%</div>
                  <div className="text-2xl font-semibold tabular-nums">{catStats.at21}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Auto-appliqué (à revoir)</div>
                  <div className={`text-2xl font-semibold tabular-nums ${catStats.auto > 0 ? "text-amber-600" : "text-emerald-600"}`}>{catStats.auto}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Rechercher une catégorie…"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="max-w-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {filteredCat.length} résultat{filteredCat.length > 1 ? "s" : ""} (max 500 catégories les plus impactantes)
                </span>
              </div>

              {loadingCat ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
              ) : filteredCat.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune catégorie trouvée.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Produits actifs</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">TVA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCat.slice(0, 200).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-[420px]">
                          <div className="truncate" title={c.name}>{c.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.slug}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.product_count}</TableCell>
                        <TableCell>
                          {c.was_auto_defaulted ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                              <Info className="w-3 h-3 mr-1" /> Auto 21% — à confirmer
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                              Validé
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            value={String(c.vat_rate ?? "21")}
                            onChange={(e) => updateCatVat.mutate({ id: c.id, rate: Number(e.target.value) })}
                          >
                            <option value="6">6%</option>
                            <option value="12">12%</option>
                            <option value="21">21%</option>
                          </select>
                        </TableCell>
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
