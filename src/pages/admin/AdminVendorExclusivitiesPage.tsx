import { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, Copy, X, Search } from "lucide-react";
import { getVendorAdminName } from "@/lib/vendor-display";

/**
 * Admin CRUD for vendor_exclusivities (Lot 2).
 * Schema lives in migration 20260526191009 — see mem://features/vendor-exclusivities.
 * Triggers DB enforce overlap & block invariants ; on remonte les erreurs telles
 * quelles dans les toasts pour rester lisible.
 */

type Scope = "brand" | "manufacturer" | "product" | "category";
type Mode = "showcase" | "hide" | "block";
type StatusFilter = "active" | "future" | "expired" | "all";

interface ExclusivityRow {
  id: string;
  vendor_id: string;
  scope: Scope;
  brand_id: string | null;
  manufacturer_id: string | null;
  product_id: string | null;
  category_id: string | null;
  mode: Mode;
  valid_from: string;
  valid_until: string;
  country_codes: string[] | null;
  reason: string | null;
  contract_ref: string | null;
  is_active: boolean;
  created_at: string;
}

const SCOPE_META: Record<Scope, { label: string; table: "brands" | "manufacturers" | "products" | "categories" }> = {
  brand: { label: "Marque", table: "brands" },
  manufacturer: { label: "Fabricant", table: "manufacturers" },
  product: { label: "Produit", table: "products" },
  category: { label: "Catégorie", table: "categories" },
};

const MODE_META: Record<Mode, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; hint: string }> = {
  showcase: { label: "Mise en avant", variant: "default", hint: "Toutes les offres restent visibles. Le vendeur exclusif est mis en valeur (badge / pictogramme)." },
  hide: { label: "Masquer concurrents", variant: "secondary", hint: "Les offres concurrentes sont masquées côté acheteur ; seules celles du vendeur exclusif restent visibles." },
  block: { label: "Bloquer concurrents", variant: "destructive", hint: "Aucune autre offre ne peut être créée / activée pendant la période (trigger DB)." },
};

const COUNTRY_OPTIONS = ["BE", "FR", "LU", "NL", "DE"];

type FormState = {
  id?: string;
  vendor_id: string;
  scope: Scope;
  target_id: string;
  target_label: string;
  mode: Mode;
  valid_from: string;
  valid_until: string;
  country_codes: string[];
  reason: string;
  contract_ref: string;
};

const emptyForm: FormState = {
  vendor_id: "",
  scope: "brand",
  target_id: "",
  target_label: "",
  mode: "showcase",
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: "",
  country_codes: [],
  reason: "",
  contract_ref: "",
};

export default function AdminVendorExclusivitiesPage() {
  const qc = useQueryClient();
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [vendorFilterOpen, setVendorFilterOpen] = useState(false);
  const [filterScope, setFilterScope] = useState<Scope | "all">("all");
  const [filterMode, setFilterMode] = useState<Mode | "all">("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("active");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // List
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-exclusivities", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("vendor_exclusivities" as any)
        .select("id, vendor_id, scope, brand_id, manufacturer_id, product_id, category_id, mode, valid_from, valid_until, country_codes, reason, contract_ref, is_active, created_at")
        .order("valid_until", { ascending: true });
      const nowIso = new Date().toISOString();
      if (filterStatus === "active") q = q.eq("is_active", true).lte("valid_from", nowIso).gt("valid_until", nowIso);
      else if (filterStatus === "future") q = q.gt("valid_from", nowIso);
      else if (filterStatus === "expired") q = q.lte("valid_until", nowIso);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ExclusivityRow[];
    },
  });

  // Vendors for filter + form
  const { data: vendors = [] } = useQuery({
    queryKey: ["admin-exclusivities-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, display_code")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string | null; company_name: string | null; display_code: string | null }>;
    },
  });
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  // Targets resolution for table display
  const targetIds = useMemo(() => {
    const byScope: Record<Scope, Set<string>> = { brand: new Set(), manufacturer: new Set(), product: new Set(), category: new Set() };
    rows.forEach((r) => {
      const id = r.brand_id || r.manufacturer_id || r.product_id || r.category_id;
      if (id) byScope[r.scope].add(id);
    });
    return byScope;
  }, [rows]);

  const { data: targetLabels = new Map<string, string>() } = useQuery({
    queryKey: ["admin-exclusivities-targets", Array.from(targetIds.brand), Array.from(targetIds.manufacturer), Array.from(targetIds.product), Array.from(targetIds.category)],
    enabled: rows.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      const queries: Promise<any>[] = [];
      if (targetIds.brand.size) queries.push(Promise.resolve(supabase.from("brands").select("id, name").in("id", Array.from(targetIds.brand))));
      if (targetIds.manufacturer.size) queries.push(Promise.resolve(supabase.from("manufacturers").select("id, name").in("id", Array.from(targetIds.manufacturer))));
      if (targetIds.product.size) queries.push(Promise.resolve(supabase.from("products").select("id, name").in("id", Array.from(targetIds.product))));
      if (targetIds.category.size) queries.push(Promise.resolve(supabase.from("categories").select("id, name").in("id", Array.from(targetIds.category))));
      const results = await Promise.all(queries);
      results.forEach((res) => {
        (res.data || []).forEach((row: any) => map.set(row.id, row.name || row.id));
      });
      return map;
    },
  });

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterVendor !== "all" && r.vendor_id !== filterVendor) return false;
      if (filterScope !== "all" && r.scope !== filterScope) return false;
      if (filterMode !== "all" && r.mode !== filterMode) return false;
      if (filterCountry !== "all") {
        if (!r.country_codes || r.country_codes.length === 0) return false;
        if (!r.country_codes.includes(filterCountry)) return false;
      }
      if (term) {
        const v = vendorById.get(r.vendor_id);
        const vName = (v ? getVendorAdminName({ name: v.name, company_name: v.company_name, display_code: v.display_code }) : "").toLowerCase();
        const targetId = r.brand_id || r.manufacturer_id || r.product_id || r.category_id || "";
        const targetLabel = (targetLabels.get(targetId) || "").toLowerCase();
        if (!vName.includes(term) && !targetLabel.includes(term) && !(r.reason || "").toLowerCase().includes(term) && !(r.contract_ref || "").toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [rows, filterVendor, filterScope, filterMode, filterCountry, search, vendorById, targetLabels]);

  // Save (insert or update)
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.vendor_id) throw new Error("Vendeur requis");
      if (!form.target_id) throw new Error(`${SCOPE_META[form.scope].label} requise`);
      if (!form.valid_until) throw new Error("Date de fin requise");
      if (new Date(form.valid_until) <= new Date(form.valid_from)) throw new Error("La date de fin doit être après le début");

      const payload: any = {
        vendor_id: form.vendor_id,
        scope: form.scope,
        brand_id: form.scope === "brand" ? form.target_id : null,
        manufacturer_id: form.scope === "manufacturer" ? form.target_id : null,
        product_id: form.scope === "product" ? form.target_id : null,
        category_id: form.scope === "category" ? form.target_id : null,
        mode: form.mode,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: new Date(form.valid_until).toISOString(),
        country_codes: form.country_codes.length > 0 ? form.country_codes : null,
        reason: form.reason || null,
        contract_ref: form.contract_ref || null,
      };

      if (form.id) {
        const { error } = await supabase.from("vendor_exclusivities" as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendor_exclusivities" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Exclusivité mise à jour" : "Exclusivité créée");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-exclusivities"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("overlap")) {
        toast.error("Conflit : une autre exclusivité bloquante existe déjà sur cette cible/période/pays.");
      } else if (msg.toLowerCase().includes("blocked")) {
        toast.error("Action bloquée : une exclusivité 'block' active empêche cette opération.");
      } else {
        toast.error(`Échec : ${msg || "erreur inconnue"}`);
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_exclusivities" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exclusivité supprimée");
      qc.invalidateQueries({ queryKey: ["admin-exclusivities"] });
    },
    onError: (e: any) => toast.error(`Échec suppression : ${e?.message ?? "erreur"}`),
  });

  const endNowMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_exclusivities" as any).update({ valid_until: new Date().toISOString(), is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exclusivité désactivée");
      qc.invalidateQueries({ queryKey: ["admin-exclusivities"] });
    },
    onError: (e: any) => toast.error(`Échec : ${e?.message ?? "erreur"}`),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (r: ExclusivityRow) => {
    const targetId = r.brand_id || r.manufacturer_id || r.product_id || r.category_id || "";
    setForm({
      id: r.id,
      vendor_id: r.vendor_id,
      scope: r.scope,
      target_id: targetId,
      target_label: targetLabels.get(targetId) || "",
      mode: r.mode,
      valid_from: r.valid_from.slice(0, 10),
      valid_until: r.valid_until.slice(0, 10),
      country_codes: r.country_codes || [],
      reason: r.reason || "",
      contract_ref: r.contract_ref || "",
    });
    setOpen(true);
  };
  const openDuplicate = (r: ExclusivityRow) => {
    openEdit(r);
    setForm((f) => ({ ...f, id: undefined }));
  };

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      active: rows.filter((r) => r.is_active && new Date(r.valid_from).getTime() <= now && new Date(r.valid_until).getTime() > now).length,
      future: rows.filter((r) => new Date(r.valid_from).getTime() > now).length,
      expired: rows.filter((r) => new Date(r.valid_until).getTime() <= now).length,
    };
  }, [rows]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <Helmet><title>Exclusivités vendeurs — Admin MediKong</title></Helmet>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Exclusivités vendeurs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Règles de mise en avant / masquage / blocage par vendeur, scope (marque, fabricant, produit, catégorie) et période.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nouvelle règle</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Actives" value={counts.active} />
        <KpiCard label="À venir" value={counts.future} />
        <KpiCard label="Expirées" value={counts.expired} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Vendeur, cible, motif…" className="pl-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Vendeur</Label>
              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{getVendorAdminName({ name: v.name, company_name: v.company_name, display_code: v.display_code })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Scope</Label>
              <Select value={filterScope} onValueChange={(v) => setFilterScope(v as Scope | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {(Object.keys(SCOPE_META) as Scope[]).map((s) => (
                    <SelectItem key={s} value={s}>{SCOPE_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as Mode | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {(Object.keys(MODE_META) as Mode[]).map((m) => (
                    <SelectItem key={m} value={m}>{MODE_META[m].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Statut</Label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actives</SelectItem>
                  <SelectItem value="future">À venir</SelectItem>
                  <SelectItem value="expired">Expirées</SelectItem>
                  <SelectItem value="all">Toutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Pays</Label>
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {COUNTRY_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Règles ({filteredRows.length})</CardTitle>
          <CardDescription>Les triggers DB rejettent les chevauchements bloquants ; toute erreur Postgres est remontée telle quelle.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Chargement…</div>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune règle pour ces filtres.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendeur</TableHead>
                    <TableHead>Scope · Cible</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead>Motif / Réf. contrat</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => {
                    const v = vendorById.get(r.vendor_id);
                    const vName = v ? getVendorAdminName({ name: v.name, company_name: v.company_name, display_code: v.display_code }) : r.vendor_id.slice(0, 8);
                    const targetId = r.brand_id || r.manufacturer_id || r.product_id || r.category_id || "";
                    const targetLabel = targetLabels.get(targetId) || targetId.slice(0, 8) + "…";
                    const meta = MODE_META[r.mode];
                    const now = Date.now();
                    const isActive = r.is_active && new Date(r.valid_from).getTime() <= now && new Date(r.valid_until).getTime() > now;
                    return (
                      <TableRow key={r.id} className={!isActive ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{vName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="mr-2">{SCOPE_META[r.scope].label}</Badge>
                          <span className="text-sm">{targetLabel}</span>
                        </TableCell>
                        <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                        <TableCell className="text-xs">{r.country_codes && r.country_codes.length ? r.country_codes.join(", ") : <span className="text-muted-foreground">Tous</span>}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(r.valid_from).toLocaleDateString("fr-FR")} → {new Date(r.valid_until).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate" title={`${r.reason || ""} ${r.contract_ref ? `· ${r.contract_ref}` : ""}`.trim()}>
                          {r.reason || <span className="text-muted-foreground">—</span>}
                          {r.contract_ref && <span className="text-muted-foreground"> · {r.contract_ref}</span>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" title="Modifier" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Dupliquer" onClick={() => openDuplicate(r)}><Copy className="h-4 w-4" /></Button>
                          {isActive && (
                            <Button size="icon" variant="ghost" title="Désactiver maintenant" onClick={() => { if (confirm("Désactiver cette exclusivité maintenant ?")) endNowMut.mutate(r.id); }}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Supprimer" onClick={() => { if (confirm("Supprimer définitivement cette règle ?")) deleteMut.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExclusivityFormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        setForm={setForm}
        vendors={vendors}
        onSave={() => saveMut.mutate()}
        isSaving={saveMut.isPending}
      />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Form Dialog
// ============================================================

function ExclusivityFormDialog({
  open, onOpenChange, form, setForm, vendors, onSave, isSaving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  vendors: Array<{ id: string; name: string | null; company_name: string | null; display_code: string | null }>;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier l'exclusivité" : "Nouvelle exclusivité"}</DialogTitle>
          <DialogDescription>
            Les triggers DB rejettent automatiquement tout chevauchement bloquant. Période et cible obligatoires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vendeur */}
          <div>
            <Label>Vendeur exclusif <span className="text-destructive">*</span></Label>
            <Select value={form.vendor_id} onValueChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un vendeur" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{getVendorAdminName({ name: v.name, company_name: v.company_name, display_code: v.display_code })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scope + cible */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scope <span className="text-destructive">*</span></Label>
              <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as Scope, target_id: "", target_label: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_META) as Scope[]).map((s) => (
                    <SelectItem key={s} value={s}>{SCOPE_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{SCOPE_META[form.scope].label} cible <span className="text-destructive">*</span></Label>
              <TargetSearchInput
                table={SCOPE_META[form.scope].table}
                value={form.target_id}
                label={form.target_label}
                onChange={(id, label) => setForm((f) => ({ ...f, target_id: id, target_label: label }))}
              />
            </div>
          </div>

          {/* Mode */}
          <div>
            <Label>Mode <span className="text-destructive">*</span></Label>
            <RadioGroup value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v as Mode }))} className="grid grid-cols-1 gap-2 mt-2">
              {(Object.keys(MODE_META) as Mode[]).map((m) => (
                <Label key={m} htmlFor={`mode-${m}`} className="flex items-start gap-2 border rounded-md p-3 cursor-pointer hover:bg-muted/40">
                  <RadioGroupItem id={`mode-${m}`} value={m} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={MODE_META[m].variant}>{MODE_META[m].label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{MODE_META[m].hint}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Du <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
            </div>
            <div>
              <Label>Au <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>

          {/* Pays */}
          <div>
            <Label>Pays concernés <span className="text-xs text-muted-foreground">(vide = tous)</span></Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COUNTRY_OPTIONS.map((c) => {
                const checked = form.country_codes.includes(c);
                return (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={checked ? "default" : "outline"}
                    onClick={() => setForm((f) => ({
                      ...f,
                      country_codes: checked ? f.country_codes.filter((x) => x !== c) : [...f.country_codes, c],
                    }))}
                  >{c}</Button>
                );
              })}
            </div>
          </div>

          {/* Motif + réf */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Référence contrat</Label>
              <Input value={form.contract_ref} onChange={(e) => setForm((f) => ({ ...f, contract_ref: e.target.value }))} placeholder="ex. EXC-2026-007" />
            </div>
            <div>
              <Label>Motif (libre)</Label>
              <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="ex. exclu distrib BE" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annuler</Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {form.id ? "Enregistrer" : "Créer la règle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Target search input (debounced)
// ============================================================

function TargetSearchInput({
  table, value, label, onChange,
}: {
  table: "brands" | "manufacturers" | "products" | "categories";
  value: string;
  label: string;
  onChange: (id: string, label: string) => void;
}) {
  const [query, setQuery] = useState(label);
  const [debounced, setDebounced] = useState("");
  const [showList, setShowList] = useState(false);

  useEffect(() => { setQuery(label); }, [label]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["admin-excl-target", table, debounced],
    enabled: debounced.length >= 2 && showList,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .ilike("name", `%${debounced}%`)
        .limit(20);
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowList(true); if (e.target.value !== label) onChange("", e.target.value); }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 150)}
        placeholder={`Rechercher (≥ 2 caractères)…`}
      />
      {value && <Badge variant="secondary" className="mt-1 text-[10px] font-mono">{value.slice(0, 8)}…</Badge>}
      {showList && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              onClick={() => { onChange(r.id, r.name); setQuery(r.name); setShowList(false); }}
            >
              {r.name}
              <span className="text-[10px] font-mono text-muted-foreground ml-2">{r.id.slice(0, 8)}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
