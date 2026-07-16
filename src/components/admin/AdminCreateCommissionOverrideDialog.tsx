import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ShieldCheck, Search, Loader2, Calculator, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Zap } from "lucide-react";

type Model = "flat_percentage" | "margin_split" | "fixed_amount";
type Scope = "product" | "offer";

interface Props {
  trigger?: React.ReactNode;
  defaultScope?: Scope;
}

export function AdminCreateCommissionOverrideDialog({ trigger, defaultScope = "product" }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [quickMode, setQuickMode] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastCreatedLabel, setLastCreatedLabel] = useState<string | null>(null);


  // shared rule state
  const [model, setModel] = useState<Model>("margin_split");
  const [rate, setRate] = useState("");
  const [split, setSplit] = useState("");
  const [fixed, setFixed] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);

  // scope=product : vendor + product
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorLabel, setVendorLabel] = useState<string>("");
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState<string>("");

  // scope=offer : offer picker (search by product or gtin, choose offer)
  const [offerQuery, setOfferQuery] = useState("");
  const [offerId, setOfferId] = useState<string | null>(null);
  const [offerLabel, setOfferLabel] = useState<string>("");

  const { data: vendors } = useQuery({
    enabled: open && scope === "product" && vendorQuery.trim().length >= 2,
    queryKey: ["admin-cco-vendors", vendorQuery],
    queryFn: async () => {
      const q = `%${vendorQuery.trim()}%`;
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name")
        .or(`name.ilike.${q},company_name.ilike.${q}`)
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    enabled: open && scope === "product" && productQuery.trim().length >= 2,
    queryKey: ["admin-cco-products", productQuery],
    queryFn: async () => {
      const q = `%${productQuery.trim()}%`;
      const { data, error } = await supabase
        .from("products")
        .select("id, name, gtin")
        .or(`name.ilike.${q},gtin.ilike.${q}`)
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: offers } = useQuery({
    enabled: open && scope === "offer" && offerQuery.trim().length >= 2,
    queryKey: ["admin-cco-offers", offerQuery],
    queryFn: async () => {
      const q = `%${offerQuery.trim()}%`;
      const { data, error } = await supabase
        .from("offers")
        .select("id, vendor_id, product_id, price_ht, vendors:vendor_id(name, company_name), products:product_id(name, gtin)")
        .or(`products.name.ilike.${q},products.gtin.ilike.${q}`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // ---- Preview : offres impactées ----
  type PreviewOffer = {
    id: string;
    vendor_label: string;
    product_label: string;
    price_ht: number | null;
    purchase_ht: number | null;
  };

  const previewEnabled =
    open && (
      (scope === "product" && !!vendorId && !!productId) ||
      (scope === "offer" && !!offerId)
    );

  const { data: previewOffers = [], isFetching: previewLoading } = useQuery({
    enabled: previewEnabled,
    queryKey: ["admin-cco-preview", scope, vendorId, productId, offerId],
    queryFn: async (): Promise<PreviewOffer[]> => {
      const base = (supabase as any)
        .from("offers_private")
        .select(
          "id, price_excl_vat, purchase_price_excl_vat, purchase_price, vendors:vendor_id(name, company_name), products:product_id(name, gtin)"
        );
      const q = scope === "product"
        ? base.eq("vendor_id", vendorId!).eq("product_id", productId!)
        : base.eq("id", offerId!);
      const { data, error } = await q.limit(20);
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        id: o.id,
        vendor_label: o.vendors?.company_name || o.vendors?.name || "—",
        product_label: `${o.products?.name ?? "—"}${o.products?.gtin ? ` · ${o.products.gtin}` : ""}`,
        price_ht: o.price_excl_vat != null ? Number(o.price_excl_vat) : null,
        purchase_ht: o.purchase_price_excl_vat != null
          ? Number(o.purchase_price_excl_vat)
          : o.purchase_price != null ? Number(o.purchase_price) : null,
      }));
    },
  });

  const computePreview = (o: PreviewOffer) => {
    const pv = o.price_ht;
    const cost = o.purchase_ht;
    const grossMargin = pv != null && cost != null ? pv - cost : null;
    let commission: number | null = null;
    if (model === "flat_percentage" && rate !== "" && pv != null) {
      commission = pv * (Number(rate) / 100);
    } else if (model === "margin_split" && split !== "" && grossMargin != null) {
      commission = grossMargin * ((100 - Number(split)) / 100); // part MediKong
    } else if (model === "fixed_amount" && fixed !== "") {
      commission = Number(fixed);
    }
    const netVendor = grossMargin != null && commission != null ? grossMargin - commission : null;
    const netPct = netVendor != null && pv ? (netVendor / pv) * 100 : null;
    return { pv, cost, grossMargin, commission, netVendor, netPct };
  };

  const fmt = (n: number | null | undefined, suffix = " €") =>
    n == null || Number.isNaN(n) ? "—" : `${n.toFixed(2)}${suffix}`;


  // ---- Détection d'override existant / chevauchement de période ----
  type ExistingOverride = {
    id: string;
    model: string;
    rate: number | null;
    split: number | null;
    fixed: number | null;
    valid_from: string | null;
    valid_until: string | null;
    source: "product" | "offer";
    context?: string;
  };

  const { data: existingOverrides = [], isFetching: existingLoading } = useQuery({
    enabled: previewEnabled,
    queryKey: ["admin-cco-existing", scope, vendorId, productId, offerId],
    queryFn: async (): Promise<ExistingOverride[]> => {
      if (scope === "product") {
        const { data, error } = await supabase
          .from("vendor_product_commissions")
          .select("id, commission_model, commission_rate, margin_split_pct, fixed_commission_amount, valid_from, valid_until, status")
          .eq("vendor_id", vendorId!)
          .eq("product_id", productId!)
          .eq("status", "approved");
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
          id: r.id,
          model: r.commission_model,
          rate: r.commission_rate,
          split: r.margin_split_pct,
          fixed: r.fixed_commission_amount,
          valid_from: r.valid_from,
          valid_until: r.valid_until,
          source: "product",
        }));
      }
      const { data, error } = await (supabase as any)
        .from("offers_private")
        .select("id, commission_model, commission_rate, margin_split_pct, fixed_commission_amount, commission_valid_from, commission_valid_until, commission_override_status")
        .eq("id", offerId!)
        .not("commission_model", "is", null)
        .eq("commission_override_status", "approved");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        model: r.commission_model,
        rate: r.commission_rate,
        split: r.margin_split_pct,
        fixed: r.fixed_commission_amount,
        valid_from: r.commission_valid_from,
        valid_until: r.commission_valid_until,
        source: "offer",
      }));
    },
  });

  // Deux intervalles ouverts se chevauchent si from1 < until2 ET from2 < until1
  // (NULL = ouvert de ce côté)
  const overlapsWith = (
    fromA: Date | null, untilA: Date | null,
    fromB: Date | null, untilB: Date | null,
  ): boolean => {
    const aStart = fromA ? fromA.getTime() : -Infinity;
    const aEnd = untilA ? untilA.getTime() : Infinity;
    const bStart = fromB ? fromB.getTime() : -Infinity;
    const bEnd = untilB ? untilB.getTime() : Infinity;
    return aStart < bEnd && bStart < aEnd;
  };

  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const overlappingOverrides = useMemo(() => {
    const newFrom = parseDate(validFrom);
    const newUntil = parseDate(validUntil);
    return existingOverrides.filter((ex) =>
      overlapsWith(
        newFrom, newUntil,
        ex.valid_from ? new Date(ex.valid_from) : null,
        ex.valid_until ? new Date(ex.valid_until) : null,
      ),
    );
  }, [existingOverrides, validFrom, validUntil]);

  const hasOverlap = overlappingOverrides.length > 0;

  // Reset la confirmation dès que la cible ou les dates changent
  useEffect(() => { setConfirmReplace(false); }, [scope, vendorId, productId, offerId, validFrom, validUntil]);

  const resetTargetOnly = () => {
    setVendorId(null); setVendorLabel(""); setVendorQuery("");
    setProductId(null); setProductLabel(""); setProductQuery("");
    setOfferId(null); setOfferLabel(""); setOfferQuery("");
    setConfirmReplace(false);
  };

  const reset = () => {
    resetTargetOnly();
    setRate(""); setSplit(""); setFixed("");
    setValidFrom(""); setValidUntil(""); setNote("");
    setModel("margin_split");
    setSessionCount(0);
    setLastCreatedLabel(null);
  };



  const submitMutation = useMutation({
    mutationFn: async () => {
      const payloadCommon = {
        _commission_model: model,
        _commission_rate: model === "flat_percentage" && rate !== "" ? Number(rate) : null,
        _margin_split_pct: model === "margin_split" && split !== "" ? Number(split) : null,
        _fixed_commission_amount: model === "fixed_amount" && fixed !== "" ? Number(fixed) : null,
      };
      if (scope === "product") {
        if (!vendorId || !productId) throw new Error("Sélectionnez un vendeur et un produit");
        const { error } = await supabase.rpc("admin_upsert_product_commission" as any, {
          _vendor_id: vendorId,
          _product_id: productId,
          ...payloadCommon,
          _valid_from: validFrom ? new Date(validFrom).toISOString() : null,
          _valid_until: validUntil ? new Date(validUntil).toISOString() : null,
          _note: note.trim() || null,
        });
        if (error) throw error;
      } else {
        if (!offerId) throw new Error("Sélectionnez une offre");
        const { error } = await supabase.rpc("admin_upsert_offer_commission" as any, {
          _offer_id: offerId,
          ...payloadCommon,
          _commission_valid_from: validFrom ? new Date(validFrom).toISOString() : null,
          _commission_valid_until: validUntil ? new Date(validUntil).toISOString() : null,
          _commission_override_reason: note.trim() || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-commission-overrides"] });
      qc.invalidateQueries({ queryKey: ["effective-commission"] });
      qc.invalidateQueries({ queryKey: ["vendor-offers-effective-commissions"] });
      qc.invalidateQueries({ queryKey: ["vpc"] });
      const createdLabel =
        scope === "product"
          ? `${vendorLabel || "vendeur"} × ${productLabel || "produit"}`
          : offerLabel || "offre";
      if (quickMode) {
        setSessionCount((n) => n + 1);
        setLastCreatedLabel(createdLabel);
        toast.success(`Override créé — prêt pour la cible suivante (${sessionCount + 1} au total)`);
        resetTargetOnly();
      } else {
        toast.success("Override créé et approuvé");
        reset();
        setOpen(false);
      }
    },

    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  type Errors = Partial<Record<"rate" | "split" | "fixed" | "validFrom" | "validUntil" | "range", string>>;

  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    if (model === "flat_percentage") {
      const v = Number(rate);
      if (rate === "" || isNaN(v) || v < 0 || v > 50) e.rate = "Taux entre 0 et 50 %";
    }
    if (model === "margin_split") {
      const v = Number(split);
      if (split === "" || isNaN(v) || v < 0 || v > 100) e.split = "Part vendeur entre 0 et 100 %";
    }
    if (model === "fixed_amount") {
      const v = Number(fixed);
      if (fixed === "" || isNaN(v) || v < 0) e.fixed = "Montant ≥ 0";
    }
    const dFrom = parseDate(validFrom);
    const dUntil = parseDate(validUntil);
    if (validFrom && !dFrom) e.validFrom = "Date invalide";
    if (validUntil && !dUntil) e.validUntil = "Date invalide";
    if (dFrom && dUntil && dUntil.getTime() <= dFrom.getTime()) {
      e.range = "La date de fin doit être strictement postérieure à la date de début";
    }
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, rate, split, fixed, validFrom, validUntil]);

  const hasErrors = Object.keys(errors).length > 0;

  const canSubmit = useMemo(() => {
    const targetOk = scope === "product" ? !!vendorId && !!productId : !!offerId;
    if (!targetOk || hasErrors) return false;
    if (hasOverlap && !confirmReplace) return false;
    return true;
  }, [scope, vendorId, productId, offerId, hasErrors, hasOverlap, confirmReplace]);

  const onSubmit = () => {
    if (hasErrors) {
      toast.error(Object.values(errors)[0]!);
      return;
    }
    if (hasOverlap && !confirmReplace) {
      toast.error("Confirmez le remplacement de l'override existant");
      return;
    }
    submitMutation.mutate();
  };


  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus size={14} /> Créer un override
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            Créer un override commission (admin)
          </DialogTitle>
          <DialogDescription>
            Raccourci MediKong : la règle est créée <strong>directement approuvée</strong>, sans passer par le compte vendeur.
          </DialogDescription>
        </DialogHeader>

        {/* Toggle mode création rapide + compteur session */}
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <label htmlFor="cco-quick-mode" className="flex items-center gap-2 cursor-pointer text-sm">
            <Zap size={14} className={quickMode ? "text-amber-500" : "text-muted-foreground"} />
            <span className="font-medium">Mode création rapide</span>
            <span className="text-[11px] text-muted-foreground">
              conserve modèle + période + note, ne réinitialise que la cible
            </span>
          </label>
          <div className="flex items-center gap-2">
            {sessionCount > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {sessionCount} créé{sessionCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Switch id="cco-quick-mode" checked={quickMode} onCheckedChange={setQuickMode} />
          </div>
        </div>
        {quickMode && lastCreatedLabel && (
          <div className="text-[11px] text-muted-foreground -mt-1 px-1">
            Dernier : <span className="font-medium text-foreground">{lastCreatedLabel}</span> — sélectionnez la prochaine cible pour enchaîner.
          </div>
        )}



        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList className="w-full">
            <TabsTrigger value="product" className="flex-1">Produit (vendeur × produit)</TabsTrigger>
            <TabsTrigger value="offer" className="flex-1">Offre (ligne unique)</TabsTrigger>
          </TabsList>

          <TabsContent value="product" className="space-y-3 mt-4">
            <div>
              <Label className="text-xs">Vendeur</Label>
              {vendorId ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-sm">
                  <span>{vendorLabel}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setVendorId(null); setVendorLabel(""); }}>Changer</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
                    <Input className="pl-7" placeholder="Nom vendeur ou raison sociale…"
                      value={vendorQuery} onChange={(e) => setVendorQuery(e.target.value)} />
                  </div>
                  {vendors && vendors.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-auto rounded border divide-y">
                      {vendors.map((v: any) => (
                        <button key={v.id} type="button"
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted"
                          onClick={() => { setVendorId(v.id); setVendorLabel(v.company_name || v.name || v.id); }}>
                          {v.company_name || v.name} <span className="text-xs text-muted-foreground font-mono ml-1">{v.id.slice(0,8)}…</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <Label className="text-xs">Produit</Label>
              {productId ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-sm">
                  <span>{productLabel}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setProductId(null); setProductLabel(""); }}>Changer</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
                    <Input className="pl-7" placeholder="Nom produit ou GTIN…"
                      value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
                  </div>
                  {products && products.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-auto rounded border divide-y">
                      {products.map((p: any) => (
                        <button key={p.id} type="button"
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted"
                          onClick={() => { setProductId(p.id); setProductLabel(p.name); }}>
                          {p.name} {p.gtin && <span className="text-xs text-muted-foreground font-mono ml-1">{p.gtin}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="offer" className="space-y-3 mt-4">
            <Label className="text-xs">Offre</Label>
            {offerId ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-sm">
                <span>{offerLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => { setOfferId(null); setOfferLabel(""); }}>Changer</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
                  <Input className="pl-7" placeholder="Nom produit ou GTIN…"
                    value={offerQuery} onChange={(e) => setOfferQuery(e.target.value)} />
                </div>
                {offers && offers.length > 0 && (
                  <div className="mt-1 max-h-56 overflow-auto rounded border divide-y">
                    {offers.map((o: any) => (
                      <button key={o.id} type="button"
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted"
                        onClick={() => {
                          setOfferId(o.id);
                          setOfferLabel(`${o.products?.name ?? "—"} — ${o.vendors?.company_name || o.vendors?.name || "vendeur"} · ${o.price_ht ?? "—"} € HT`);
                        }}>
                        <div className="font-medium">{o.products?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.vendors?.company_name || o.vendors?.name} · {o.price_ht ?? "—"} € HT
                          {o.products?.gtin && <> · <span className="font-mono">{o.products.gtin}</span></>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-3 pt-2 border-t mt-2">
          <div>
            <Label className="text-xs">Modèle de commission</Label>
            <RadioGroup value={model} onValueChange={(v) => setModel(v as Model)} className="mt-2 grid gap-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="margin_split" /> Partage de marge (%) — part vendeur
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="flat_percentage" /> Pourcentage fixe (%) sur PV
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="fixed_amount" /> Montant fixe (€/unité)
              </label>
            </RadioGroup>
          </div>

          {model === "flat_percentage" && (
            <div>
              <Label className="text-xs">Taux MediKong (%)</Label>
              <Input type="number" min={0} max={50} step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex. 12"
                aria-invalid={!!errors.rate} className={errors.rate ? "border-destructive" : ""} />
              {errors.rate && <p className="text-[11px] text-destructive mt-1">{errors.rate}</p>}
            </div>
          )}
          {model === "margin_split" && (
            <div>
              <Label className="text-xs">Part vendeur (%)</Label>
              <Input type="number" min={0} max={100} step="1" value={split} onChange={(e) => setSplit(e.target.value)} placeholder="ex. 60 (vendeur 60 / MediKong 40)"
                aria-invalid={!!errors.split} className={errors.split ? "border-destructive" : ""} />
              {errors.split && <p className="text-[11px] text-destructive mt-1">{errors.split}</p>}
            </div>
          )}
          {model === "fixed_amount" && (
            <div>
              <Label className="text-xs">Montant € HTVA / unité</Label>
              <Input type="number" min={0} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="ex. 0.50"
                aria-invalid={!!errors.fixed} className={errors.fixed ? "border-destructive" : ""} />
              {errors.fixed && <p className="text-[11px] text-destructive mt-1">{errors.fixed}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valide du</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                aria-invalid={!!errors.validFrom} className={errors.validFrom ? "border-destructive" : ""} />
              {errors.validFrom && <p className="text-[11px] text-destructive mt-1">{errors.validFrom}</p>}
            </div>
            <div>
              <Label className="text-xs">Valide jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                aria-invalid={!!errors.validUntil} className={errors.validUntil ? "border-destructive" : ""} />
              {errors.validUntil && <p className="text-[11px] text-destructive mt-1">{errors.validUntil}</p>}
            </div>
            {errors.range && (
              <p className="col-span-2 text-[11px] text-destructive -mt-1">{errors.range}</p>
            )}
          </div>

          {/* Bandeau conflit : override existant chevauchant la période */}
          {previewEnabled && hasOverlap && (
            <Alert variant="destructive" className="border-amber-400 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">
                {existingLoading ? "Vérification…" : "Override existant sur une période chevauchante"}
              </AlertTitle>
              <AlertDescription className="text-xs space-y-1.5 mt-1">
                {overlappingOverrides.map((ex) => (
                  <div key={ex.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="uppercase text-[10px]">{ex.source}</Badge>
                    <span className="font-medium">
                      {ex.model === "flat_percentage" && `Taux fixe ${ex.rate ?? "?"} %`}
                      {ex.model === "margin_split" && `Partage de marge — vendeur ${ex.split ?? "?"} %`}
                      {ex.model === "fixed_amount" && `Montant fixe ${ex.fixed ?? "?"} €/u.`}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      du {ex.valid_from ? new Date(ex.valid_from).toLocaleDateString("fr-BE") : "—"}
                      {" → "}
                      {ex.valid_until ? new Date(ex.valid_until).toLocaleDateString("fr-BE") : "sans fin"}
                    </span>
                  </div>
                ))}
                <label className="flex items-start gap-2 pt-2 cursor-pointer">
                  <Checkbox
                    checked={confirmReplace}
                    onCheckedChange={(v) => setConfirmReplace(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    Je confirme <strong>remplacer</strong> l'override existant par la nouvelle règle (les périodes ne peuvent pas être empilées).
                  </span>
                </label>
              </AlertDescription>
            </Alert>
          )}


          <div>
            <Label className="text-xs">Note interne</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : négociation MediKong, campagne Q3, etc." />
          </div>

          {/* Preview commission effective / marge nette */}
          {previewEnabled && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Calculator size={13} /> Prévisualisation
                {previewLoading && <Loader2 size={12} className="animate-spin" />}
              </div>
              {!previewLoading && previewOffers.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  {scope === "product"
                    ? "Ce vendeur n'a pas encore d'offre pour ce produit — l'override s'appliquera dès qu'une offre sera créée."
                    : "Offre introuvable."}
                </div>
              )}
              {previewOffers.map((o) => {
                const c = computePreview(o);
                const netColor =
                  c.netVendor == null ? "text-muted-foreground"
                  : c.netVendor < 0 ? "text-destructive"
                  : "text-emerald-600";
                return (
                  <div key={o.id} className="rounded border bg-background p-2 text-xs space-y-1.5">
                    {scope === "product" && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {o.vendor_label} · {o.product_label}
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                      <PreviewCell label="PV HTVA" value={fmt(c.pv)} />
                      <PreviewCell label="Prix achat" value={fmt(c.cost)} />
                      <PreviewCell label="Marge brute" value={fmt(c.grossMargin)} />
                      <PreviewCell
                        label="Commission MK"
                        value={
                          c.commission == null
                            ? "—"
                            : model === "flat_percentage"
                              ? `${fmt(c.commission)} (${rate || 0}% PV)`
                              : model === "margin_split"
                                ? `${fmt(c.commission)} (${100 - Number(split || 0)}% marge)`
                                : `${fmt(c.commission)} /u.`
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-[11px] text-muted-foreground">Marge nette vendeur</span>
                      <span className={`font-semibold ${netColor}`}>
                        {fmt(c.netVendor)}{c.netPct != null && ` (${c.netPct.toFixed(1)}%)`}
                      </span>
                    </div>
                    {c.cost == null && (
                      <Badge variant="outline" className="text-[10px]">
                        Prix d'achat manquant — marge nette indisponible
                      </Badge>
                    )}
                  </div>
                );
              })}
              <div className="text-[10px] text-muted-foreground italic pt-1">
                Estimation indicative (hors frais logistique, TVA, remises multi-paliers).
              </div>
            </div>
          )}
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {quickMode && sessionCount > 0 ? `Terminer (${sessionCount})` : "Annuler"}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitMutation.isPending}>
            {submitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {quickMode ? "Créer et enchaîner" : "Créer et approuver"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

function PreviewCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
