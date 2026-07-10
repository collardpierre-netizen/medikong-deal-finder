import { useState, useMemo } from "react";
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
import { Plus, ShieldCheck, Search, Loader2 } from "lucide-react";

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

  // shared rule state
  const [model, setModel] = useState<Model>("margin_split");
  const [rate, setRate] = useState("");
  const [split, setSplit] = useState("");
  const [fixed, setFixed] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");

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

  const reset = () => {
    setVendorId(null); setVendorLabel(""); setVendorQuery("");
    setProductId(null); setProductLabel(""); setProductQuery("");
    setOfferId(null); setOfferLabel(""); setOfferQuery("");
    setRate(""); setSplit(""); setFixed("");
    setValidFrom(""); setValidUntil(""); setNote("");
    setModel("margin_split");
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
      toast.success("Override créé et approuvé");
      qc.invalidateQueries({ queryKey: ["admin-commission-overrides"] });
      qc.invalidateQueries({ queryKey: ["effective-commission"] });
      qc.invalidateQueries({ queryKey: ["vpc"] });
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const validate = (): string | null => {
    if (model === "flat_percentage") {
      if (rate === "" || isNaN(Number(rate)) || Number(rate) < 0 || Number(rate) > 50)
        return "Taux entre 0 et 50 %";
    }
    if (model === "margin_split") {
      if (split === "" || isNaN(Number(split)) || Number(split) < 0 || Number(split) > 100)
        return "Part vendeur entre 0 et 100 %";
    }
    if (model === "fixed_amount") {
      if (fixed === "" || isNaN(Number(fixed)) || Number(fixed) < 0)
        return "Montant ≥ 0";
    }
    if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) {
      return "La fin doit être postérieure au début";
    }
    return null;
  };

  const canSubmit = useMemo(() => {
    if (scope === "product") return !!vendorId && !!productId;
    return !!offerId;
  }, [scope, vendorId, productId, offerId]);

  const onSubmit = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
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
              <Input type="number" min={0} max={50} step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex. 12" />
            </div>
          )}
          {model === "margin_split" && (
            <div>
              <Label className="text-xs">Part vendeur (%)</Label>
              <Input type="number" min={0} max={100} step="1" value={split} onChange={(e) => setSplit(e.target.value)} placeholder="ex. 60 (vendeur 60 / MediKong 40)" />
            </div>
          )}
          {model === "fixed_amount" && (
            <div>
              <Label className="text-xs">Montant € HTVA / unité</Label>
              <Input type="number" min={0} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="ex. 0.50" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valide du</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valide jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Note interne</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : négociation MediKong, campagne Q3, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitMutation.isPending}>
            {submitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer et approuver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
