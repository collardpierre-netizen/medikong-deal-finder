import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Sparkles, Zap } from "lucide-react";
import { useFlashSaleVendors } from "./FlashSaleVendorSettings";

interface Candidate {
  offer_id: string;
  product_id: string;
  product_name: string | null;
  brand_name: string | null;
  gtin: string | null;
  vendor_id: string;
  vendor_label: string | null;
  vendor_enabled: boolean;
  vendor_max_discount_pct: number | null;
  price_excl_vat: number | null;
  purchase_price_excl_vat: number | null;
  margin_amount: number | null;
  margin_pct: number | null;
  stock_quantity: number | null;
  moq: number | null;
  product_best_price_incl_vat: number | null;
  pvp_ttc_cents: number | null;
  market_pharmacist_price: number | null;
  market_gap_pct: number | null;
  already_in_flash: boolean;
  potential_score: number | null;
}

const fmt = (n: number | null | undefined, suffix = " €") =>
  n === null || n === undefined ? "—" : `${Number(n).toFixed(2)}${suffix}`;

function CreateFromCandidate({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const qc = useQueryClient();
  const base = candidate.product_best_price_incl_vat ?? null;
  const pvp = candidate.pvp_ttc_cents ? candidate.pvp_ttc_cents / 100 : null;
  const [discountPrice, setDiscountPrice] = useState(base ? (base * 0.85).toFixed(2) : "");
  const [publicPrice, setPublicPrice] = useState(pvp ? pvp.toFixed(2) : base ? base.toFixed(2) : "");
  const [quantityTotal, setQuantityTotal] = useState(
    candidate.stock_quantity ? String(Math.min(candidate.stock_quantity, 50)) : ""
  );
  const [label, setLabel] = useState("Flash");
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  const promo = parseFloat(discountPrice);
  const pub = parseFloat(publicPrice);
  const refPrice = Number.isFinite(pub) && pub > 0 ? pub : base;
  const discountPct =
    refPrice && Number.isFinite(promo) && promo > 0
      ? Math.round((1 - promo / refPrice) * 100)
      : null;
  const maxPct = candidate.vendor_max_discount_pct;
  const overMax = maxPct !== null && maxPct !== undefined && discountPct !== null && discountPct > maxPct;

  const handleSave = async () => {
    if (!Number.isFinite(promo) || promo <= 0 || !endsAt) {
      toast.error("Prix promo et date de fin obligatoires");
      return;
    }
    if (overMax) {
      toast.error(`Remise supérieure au plafond du fournisseur (${maxPct}%)`);
      return;
    }
    const qty = quantityTotal.trim() === "" ? null : parseInt(quantityTotal, 10);
    if (qty !== null && (!Number.isInteger(qty) || qty <= 0)) {
      toast.error("Quantité limitée invalide");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("flash_deals").insert({
      product_id: candidate.product_id,
      offer_id: candidate.offer_id,
      vendor_id: candidate.vendor_id,
      discount_price_incl_vat: promo,
      original_price_incl_vat: base ?? promo,
      public_price_incl_vat: Number.isFinite(pub) ? pub : null,
      quantity_total: qty,
      vendor_display_mode: "inherit",
      starts_at: new Date().toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      label,
      is_active: true,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vente flash créée");
    qc.invalidateQueries({ queryKey: ["flash-deals-admin"] });
    qc.invalidateQueries({ queryKey: ["flash-deal-candidates"] });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 text-sm space-y-1">
        <p className="font-medium">{candidate.product_name}</p>
        <p className="text-xs text-muted-foreground">
          {candidate.vendor_label} · {fmt(candidate.price_excl_vat)} HT · marge{" "}
          {candidate.margin_pct !== null ? `${Number(candidate.margin_pct).toFixed(1)}%` : "—"} · stock{" "}
          {candidate.stock_quantity ?? "—"}
          {candidate.moq ? ` · MOQ ${candidate.moq}` : ""}
        </p>
        {maxPct !== null && maxPct !== undefined && (
          <p className="text-xs text-muted-foreground">Plafond de remise fournisseur : {maxPct}%</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Prix promo TTC (€)</Label>
          <Input type="number" step="0.01" value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} />
        </div>
        <div>
          <Label>Prix public TTC (€)</Label>
          <Input type="number" step="0.01" value={publicPrice} onChange={(e) => setPublicPrice(e.target.value)} />
        </div>
      </div>

      {discountPct !== null && (
        <p className={`text-xs ${overMax ? "text-destructive font-medium" : "text-emerald-700"}`}>
          Remise affichée : -{discountPct}%
          {overMax && ` — au-dessus du plafond fournisseur (${maxPct}%)`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Quantité limitée</Label>
          <Input
            type="number"
            min="1"
            step="1"
            value={quantityTotal}
            onChange={(e) => setQuantityTotal(e.target.value)}
            placeholder="Vide = illimitée"
          />
        </div>
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Fin de l'offre</Label>
        <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving || overMax}>
          {saving ? "Création…" : "Créer la vente flash"}
        </Button>
      </div>
    </div>
  );
}

export function FlashDealCandidates() {
  const [onlyEnabledVendors, setOnlyEnabledVendors] = useState(true);
  const [minMargin, setMinMargin] = useState("");
  const [minStock, setMinStock] = useState("");
  const [search, setSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);

  const { data: vendors = [] } = useFlashSaleVendors();
  const vendorOptions = useMemo(
    () => vendors.filter((v) => !onlyEnabledVendors || v.is_enabled),
    [vendors, onlyEnabledVendors]
  );

  const params = {
    _only_enabled_vendors: onlyEnabledVendors,
    _min_margin_pct: minMargin.trim() === "" ? null : Number(minMargin),
    _min_stock: minStock.trim() === "" ? null : parseInt(minStock, 10),
    _search: search.trim() === "" ? null : search.trim(),
    _vendor_ids: vendorId ? [vendorId] : null,
    _limit: 100,
  };

  const { data: candidates = [], isLoading, isFetching } = useQuery({
    queryKey: ["flash-deal-candidates", params],
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase.rpc("admin_flash_deal_candidates", params as any);
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Recherche</Label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-9 w-56" placeholder="Produit, marque, EAN…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Fournisseur</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm w-56"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">Tous</option>
            {vendorOptions.map((v) => (
              <option key={v.vendor_id} value={v.vendor_id}>
                {v.company_name || v.vendor_name || v.display_code} ({v.active_offers_count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Marge min %</Label>
          <Input type="number" className="h-9 w-24" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} placeholder="—" />
        </div>
        <div>
          <Label className="text-xs">Stock min</Label>
          <Input type="number" className="h-9 w-24" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="—" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground h-9">
          <Switch checked={onlyEnabledVendors} onCheckedChange={setOnlyEnabledVendors} />
          Fournisseurs autorisés uniquement
        </label>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-right">Prix HT</TableHead>
              <TableHead className="text-right">Achat HT</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Marché pharma.</TableHead>
              <TableHead className="text-right">Écart marché</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  Aucune offre candidate — autorisez d'abord des fournisseurs dans l'onglet « Fournisseurs ».
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((c) => (
                <TableRow key={c.offer_id} className={c.already_in_flash ? "opacity-60" : ""}>
                  <TableCell className="font-medium max-w-[220px] truncate">
                    {c.product_name}
                    {c.already_in_flash && <Badge variant="outline" className="ml-1 text-[10px]">déjà en flash</Badge>}
                    {c.brand_name && <span className="block text-xs text-muted-foreground truncate">{c.brand_name}</span>}
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">
                    {c.vendor_label}
                    {!c.vendor_enabled && <Badge variant="secondary" className="ml-1 text-[10px]">non autorisé</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{fmt(c.price_excl_vat)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(c.purchase_price_excl_vat)}</TableCell>
                  <TableCell className="text-right">
                    {c.margin_pct !== null ? (
                      <span className="font-medium">{Number(c.margin_pct).toFixed(1)}%</span>
                    ) : "—"}
                    {c.margin_amount !== null && (
                      <span className="block text-xs text-muted-foreground">{fmt(c.margin_amount)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{c.stock_quantity ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(c.market_pharmacist_price)}</TableCell>
                  <TableCell className="text-right">
                    {c.market_gap_pct !== null ? (
                      <Badge variant="outline" className="text-[10px]">
                        {Number(c.market_gap_pct) > 0 ? "−" : "+"}
                        {Math.abs(Number(c.market_gap_pct)).toFixed(0)}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {c.potential_score !== null ? Number(c.potential_score).toFixed(0) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelected(c)}>
                      <Zap size={13} /> Créer
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Sparkles size={12} /> Score = 50% marge + 30% écart vs prix marché pharmacien + bonus stock, pénalisé si le
        produit est déjà en vente flash. {isFetching && "Actualisation…"}
      </p>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer une vente flash</DialogTitle></DialogHeader>
          {selected && <CreateFromCandidate candidate={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
