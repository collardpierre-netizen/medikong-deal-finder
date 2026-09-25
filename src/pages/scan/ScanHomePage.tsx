import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flashlight, Keyboard, Loader2, Camera, Search, ShoppingCart, Settings2, History, Star, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money-format";
import { QuantityInput } from "@/components/cart/QuantityInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVendorMov } from "@/hooks/useVendorMov";
import { createZxingScanner, type BarcodeScanner } from "@/lib/scanner/BarcodeScanner";
import { resolveScan, type ScanResult } from "@/lib/scanner/api";
import { useScanCustomer } from "./ScanGate";

const sb = supabase as any;
const VERDICT: Record<ScanResult["verdict"], { cls: string; title: string }> = {
  green: { cls: "verdict-green", title: "Vous avez déjà le meilleur prix" },
  orange: { cls: "verdict-orange", title: "MediKong est un peu moins cher" },
  red: { cls: "verdict-red", title: "MediKong est nettement moins cher" },
  none: { cls: "verdict-none", title: "" },
};

export default function ScanHomePage() {
  const customer = useScanCustomer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanner = useRef<BarcodeScanner | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [manual, setManual] = useState(false);
  const [cnk, setCnk] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [flash, setFlash] = useState(0);
  const [params, setParams] = useSearchParams();

  const { data: conditions = [] } = useQuery({
    queryKey: ["scan-conditions", customer.id],
    queryFn: async () => (await sb.from("pharmacist_wholesaler_settings")
      .select("id, is_supplier_of_pharmacist, override_rules_json").eq("customer_id", customer.id)).data ?? [],
  });
  const hasConditions = conditions.some((c: any) => c.is_supplier_of_pharmacist !== false);
  const estimated = conditions.some((c: any) => c.override_rules_json?.year_end_rebate || c.override_rules_json?.free_goods);

  const run = useCallback(async (raw: string, symbology: "ean13" | "datamatrix" | "manual_cnk" | "other", decodeMs: number | null, reopenId?: string) => {
    setBusy(true);
    try {
      const r = await resolveScan({ raw_code: raw, symbology, client_decode_ms: decodeMs, reopen_scan_event_id: reopenId ?? null });
      setResult(r);
    } catch {
      toast.error("Lecture impossible, réessayez.");
    } finally { setBusy(false); }
  }, []);

  // Réouverture depuis « Derniers scans » / « Mes favoris »
  const reopenId = params.get("reopen");
  const reopenCnk = params.get("cnk");
  useEffect(() => {
    if (!reopenId && !reopenCnk) return;
    setParams({}, { replace: true });
    if (reopenId) void run("0", "manual_cnk", null, reopenId);
    else if (reopenCnk) void run(reopenCnk, "manual_cnk", null);
  }, [reopenId, reopenCnk, run, setParams]);

  // Caméra active tant qu'aucun résultat n'est affiché
  useEffect(() => {
    if (result || manual || reopenId || reopenCnk) return;
    const s = createZxingScanner();
    scanner.current = s;
    s.onDetect((d) => { setFlash((n) => n + 1); s.stop(); void run(d.text, d.symbology, d.decodeMs); });
    if (videoRef.current) {
      s.start(videoRef.current)
        .then(() => { setCamError(null); setTorchAvail(s.hasTorch()); })
        .catch(() => setCamError("Caméra indisponible. Autorisez l'accès à la caméra ou saisissez le CNK."));
    }
    return () => s.stop();
  }, [result, manual, run]);

  const toggleTorch = async () => { const ok = await scanner.current?.setTorch(!torch); if (ok) setTorch(!torch); };

  return (
    <div className="space-y-4">
      <header className="bg-scan-navy text-on-navy px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">{customer.company_name ?? "Votre officine"}</div>
            <h1 className="text-xl font-extrabold">Scanner</h1>
          </div>
          <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="icon" className="scan-tap" aria-label="Derniers scans et favoris">
            <Link to="/historique"><History className="h-5 w-5" /></Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="scan-tap">
            <Link to="/conditions"><Settings2 className="mr-1 h-4 w-4" />Mes conditions</Link>
          </Button>
          </div>
        </div>
      </header>

      {!result && !manual && (
        <div className="px-5 space-y-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-scan-navy">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div key={flash} className={`pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-xl border-2 border-primary ${flash ? "scan-flash" : ""}`} />
            {busy && <div className="absolute inset-0 bg-scan-navy/40" aria-label="Recherche en cours" />}
            {torchAvail && (
              <Button size="icon" variant="secondary" className="scan-tap absolute right-3 top-3" aria-label="Lampe" onClick={toggleTorch}>
                <Flashlight className="h-5 w-5" />
              </Button>
            )}
          </div>
          {busy && <VerdictSkeleton />}
          {camError && <p className="text-sm text-muted-foreground">{camError}</p>}
          <Button variant="link" className="scan-tap w-full" onClick={() => setManual(true)}>
            <Keyboard className="mr-2 h-4 w-4" />Code illisible ? Saisir le CNK
          </Button>
        </div>
      )}

      {!result && manual && (
        <form className="px-5 space-y-3" onSubmit={(e) => { e.preventDefault(); const v = cnk.replace(/\D/g, ""); if (v) void run(v, v.length === 13 ? "ean13" : "manual_cnk", null); }}>
          <Input inputMode="numeric" autoFocus placeholder="CNK (7 chiffres) ou EAN" value={cnk} onChange={(e) => setCnk(e.target.value)} className="h-12 text-lg" />
          <Button type="submit" className="scan-tap h-12 w-full text-base" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="mr-2 h-4 w-4" />Rechercher</>}
          </Button>
          <Button type="button" variant="ghost" className="scan-tap w-full" onClick={() => setManual(false)}>Revenir à la caméra</Button>
        </form>
      )}

      {!result && (reopenId || reopenCnk || (manual && busy)) && <div className="px-5"><VerdictSkeleton /></div>}
      {result && (
        <div className="px-5 space-y-4">
          {result.product && result.best
            ? <VerdictCard r={result} customerId={customer.id} hasConditions={hasConditions} estimated={estimated} onResult={setResult} onScanNext={() => { setResult(null); setManual(false); setCnk(""); }} />
            : <NoOfferCard r={result} customerId={customer.id} onResult={setResult} />}
          <Button variant="outline" className="scan-tap h-12 w-full text-base" onClick={() => { setResult(null); setManual(false); setCnk(""); }}>
            <Camera className="mr-2 h-5 w-5" />Scanner un autre produit
          </Button>
        </div>
      )}
    </div>
  );
}

function VerdictSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="flex gap-3"><div className="scan-skeleton h-20 w-20" /><div className="flex-1 space-y-2"><div className="scan-skeleton h-4 w-3/4" /><div className="scan-skeleton h-3 w-1/2" /></div></div>
      <div className="scan-skeleton h-36 w-full" />
      <div className="scan-skeleton h-20 w-full" />
    </div>
  );
}

/** Compteur qui défile jusqu'à sa valeur (< 300 ms), instantané si réduction de mouvement. */
function useCountUp(target: number | null, ms = 260) {
  const [v, setV] = useState(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const fmtPct = (n: number | null | undefined) => n == null ? "" : `${String(Math.round(n)).replace(".", ",")} %`;

function FavoriteStar({ customerId, productId }: { customerId: string; productId: string }) {
  const qc = useQueryClient();
  const key = ["scan-favorite", customerId, productId];
  const { data: fav } = useQuery({
    queryKey: key,
    queryFn: async () => (await sb.from("scan_favorites").select("id").eq("customer_id", customerId).eq("product_id", productId).maybeSingle()).data,
  });
  const toggle = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = fav
      ? await sb.from("scan_favorites").delete().eq("id", fav.id)
      : await sb.from("scan_favorites").insert({ customer_id: customerId, product_id: productId, created_by: u.user?.id });
    if (error) { toast.error("Favori non enregistré, réessayez."); return; }
    toast.success(fav ? "Retiré des favoris" : "Ajouté aux favoris");
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["scan-favorites", customerId] });
  };
  return (
    <Button type="button" variant="ghost" size="icon" className="scan-tap shrink-0" aria-pressed={!!fav} aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={toggle}>
      <Star className={`h-6 w-6 ${fav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
    </Button>
  );
}

function ProductHead({ r, customerId }: { r: ScanResult; customerId?: string }) {
  return (
    <div className="flex gap-3">
      {r.product?.image
        ? <img src={r.product.image} alt="" className="h-20 w-20 rounded-lg bg-card object-contain" />
        : <div className="h-20 w-20 rounded-lg bg-muted" />}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-bold leading-tight">{r.product?.name ?? "Produit inconnu"}</div>
        <div className="text-xs text-muted-foreground">
          {r.product?.pack ? `Conditionnement : ${r.product.pack}` : null}
          {r.product?.cnk ? ` · CNK ${r.product.cnk}` : null}
        </div>
        {(r.lot || r.expiry_date) && (
          <div className="text-xs text-muted-foreground">
            {r.lot ? `Lot ${r.lot}` : ""}{r.lot && r.expiry_date ? " · " : ""}{r.expiry_date ? `Péremption ${new Date(r.expiry_date).toLocaleDateString("fr-BE")}` : ""}
          </div>
        )}
        {!r.in_test_scope && <Badge variant="secondary">Hors périmètre du test</Badge>}
      </div>
      {customerId && r.product && <FavoriteStar customerId={customerId} productId={r.product.id} />}
    </div>
  );
}

function VerdictCard({ r, customerId, hasConditions, estimated, onResult, onScanNext }: { r: ScanResult; customerId: string; hasConditions: boolean; estimated: boolean; onResult: (r: ScanResult) => void; onScanNext: () => void }) {
  const { addToCart } = useCart();
  const declaredReference = r.references.find((reference) => reference.source === "DECLARED");
  const declaredSupplierName = declaredReference?.label.replace(/^Prix déclaré ·\s*/, "") ?? "";
  const [quantity, setQuantity] = useState(1);
  const [declaredPrice, setDeclaredPrice] = useState(declaredReference ? String(declaredReference.net).replace(".", ",") : "");
  const [declaredSupplier, setDeclaredSupplier] = useState(declaredSupplierName);
  const [editingDeclaredPrice, setEditingDeclaredPrice] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const { data: offerMeta } = useQuery({
    queryKey: ["scan-offer-meta", r.best?.offer_id],
    queryFn: async () => {
      const { data } = await sb.from("offers").select("vendor_id, stock_quantity").eq("id", r.best!.offer_id).maybeSingle();
      return data as { vendor_id: string; stock_quantity: number | null } | null;
    },
    enabled: !!r.best?.offer_id,
  });
  const vendorId = r.best?.vendor_id ?? offerMeta?.vendor_id;
  const stockQuantity = r.best?.stock_quantity ?? offerMeta?.stock_quantity ?? null;
  const topOffers = r.top_offers ?? [];
  const [showOthers, setShowOthers] = useState(false);
  const vendorIds = Array.from(new Set([vendorId, ...topOffers.map((o) => o.vendor_id)].filter(Boolean))) as string[];
  const { getMovForVendor } = useVendorMov(vendorIds);
  const animatedGain = useCountUp(r.delta != null && r.delta > 0 ? r.delta : null);
  const mov = vendorId ? getMovForVendor(vendorId) : null;
  const subtotal = (r.best?.price ?? 0) * quantity;
  const movRemaining = mov != null ? Math.max(mov - subtotal, 0) : 0;
  const francoTarget = r.best?.franco ?? 250;
  const francoRemaining = Math.max(francoTarget - subtotal, 0);
  const v = VERDICT[r.verdict];
  const gain = r.delta != null && r.delta > 0 ? r.delta : null;
  const soldUnits = Math.max(1, Number(r.product?.pack ?? 1));
  const unitPrice = soldUnits > 1 && r.best ? r.best.price / soldUnits : null;
  const minimumBoxCount = mov != null && r.best?.price ? Math.ceil(mov / r.best.price) : null;
  const add = (scanNext: boolean) => {
    if (!r.best || !r.product) return;
    addToCart.mutate({
      offerId: r.best.offer_id, productId: r.product.id, quantity, maxQuantity: stockQuantity ?? undefined, vendorId, priceExclVat: r.best.price, deliveryDays: r.best.lead_time_days,
      productData: { id: r.product.id, name: r.product.name, brand: "", slug: "", price: r.best.price, imageUrl: r.product.image ?? undefined },
      openDrawer: false,
      undoToast: true,
    });
    void sb.from("scan_cart_attributions").insert({ customer_id: customerId, offer_id: r.best.offer_id, scan_event_id: r.scan_event_id })
      .then(({ error }: { error: { message: string } | null }) => { if (error) console.error("scan attribution failed", error.message); });
    if (scanNext) onScanNext();
  };
  const compareDeclaredPrice = async () => {
    const euros = Number(declaredPrice.replace(",", "."));
    if (!Number.isFinite(euros) || euros <= 0) { toast.error("Indiquez un prix HTVA valide."); return; }
    if (!declaredSupplier) { toast.error("Choisissez votre grossiste ou labo."); return; }
    setDeclaring(true);
    try {
      const { data, error } = await sb.rpc("scan_declare_product_price", {
        _scan_event_id: r.scan_event_id,
        _price_excl_vat_cents: Math.round(euros * 100),
        _supplier_name: declaredSupplier,
      });
      if (error) throw error;
      onResult({
        ...r,
        verdict: data.verdict,
        delta: Number(data.delta),
        best_reference_price: Number(data.best_reference_price),
        references: [{ source: "DECLARED", label: `Prix déclaré · ${data.supplier_name}`, discount_pct: 0, net: Number(data.best_reference_price) }],
      });
      setEditingDeclaredPrice(false);
      toast.success("Prix enregistré pour votre officine");
    } catch (error) {
      console.error("declared price failed", error);
      toast.error("Comparaison impossible, réessayez.");
    } finally { setDeclaring(false); }
  };
  return (
    <div className="space-y-3">
      <ProductHead r={r} customerId={customerId} />
      <div className="rounded-xl border-2 border-primary bg-card p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="font-bold">MediKong</span>
          <span className="text-2xl font-extrabold">{formatMoney(r.best!.price)} <span className="text-xs font-normal text-muted-foreground">HTVA</span></span>
        </div>
        <div className="text-sm text-muted-foreground">
          {r.best!.vendor_label}
          {r.best!.lead_time_days != null ? ` · livraison ${r.best!.lead_time_days} j` : ""}
          {r.best!.franco != null ? ` · franco ${formatMoney(r.best!.franco)}` : ""}
        </div>
        {r.market_price && (
          <div className="text-xs text-muted-foreground">
            Prix B2B constaté : {formatMoney(r.market_price.price_excl_vat)} HTVA · {new Date(r.market_price.observed_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" })}
          </div>
        )}
        {r.margin?.medikong && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-semibold">
              Votre marge : {formatMoney(r.margin.medikong.eur)} · {fmtPct(r.margin.medikong.pct)}
            </div>
            {r.margin.current?.pct != null && r.margin.medikong.pct != null && (
              <div className="text-muted-foreground">Votre marge passe de {fmtPct(r.margin.current.pct)} à {fmtPct(r.margin.medikong.pct)}</div>
            )}
            <div className="text-xs text-muted-foreground">Prix public {formatMoney(r.margin.pvp_ttc)} TVAC · {formatMoney(r.margin.pvp_ht)} HTVA (TVA {String(r.margin.vat_pct).replace(".", ",")} %)</div>
          </div>
        )}
        {soldUnits > 1 && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-semibold">Vendu par pack de {soldUnits}</div>
            {unitPrice != null && <div className="text-muted-foreground">{formatMoney(unitPrice)} HTVA par bouteille</div>}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-sm font-medium">Quantité</span>
          <QuantityInput value={quantity} min={1} max={stockQuantity ?? undefined} onChange={setQuantity} />
        </div>
        <div className="grid grid-cols-3 gap-2" aria-label="Quantités rapides">
          {[6, 12, 24].map((quickQuantity) => (
            <Button key={quickQuantity} type="button" variant="outline" size="sm" className="scan-tap" onClick={() => setQuantity(stockQuantity ? Math.min(quickQuantity, stockQuantity) : quickQuantity)}>
              {quickQuantity}
            </Button>
          ))}
        </div>
        {mov != null && movRemaining > 0 ? (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-medium">Minimum de commande</div>
            <div className="mt-1 text-muted-foreground">Il manque {formatMoney(movRemaining)} pour atteindre le minimum de commande de ce fournisseur ({formatMoney(mov)} HTVA).</div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-medium">Franco de port</div>
            <div className="mt-1 text-muted-foreground">{francoRemaining > 0 ? `Plus que ${formatMoney(francoRemaining)} pour la livraison gratuite` : "✓ Livraison gratuite"}</div>
          </div>
        )}
        {topOffers.length > 1 && (
          <div className="border-t pt-2">
            <Button type="button" variant="ghost" size="sm" className="scan-tap w-full justify-between px-1" aria-expanded={showOthers} onClick={() => setShowOthers((x) => !x)}>
              <span>{topOffers.length - 1} autre{topOffers.length > 2 ? "s" : ""} offre{topOffers.length > 2 ? "s" : ""}</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showOthers ? "rotate-180" : ""}`} />
            </Button>
            {showOthers && (
              <div className="mt-1 space-y-2">
                {topOffers.slice(1).map((o) => {
                  const m = getMovForVendor(o.vendor_id);
                  return (
                    <div key={o.offer_id} className="flex items-baseline justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{o.vendor_label}</div>
                        <div className="text-xs text-muted-foreground">
                          {m != null ? `Minimum de commande ${formatMoney(m)} HTVA` : "Sans minimum de commande"}
                          {o.lead_time_days != null ? ` · livraison ${o.lead_time_days} j` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 font-bold">{formatMoney(o.price)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <Button className="scan-tap h-12 w-full text-base" onClick={() => add(true)}><Camera className="mr-2 h-5 w-5" />Ajouter et scanner le suivant</Button>
        <Button asChild variant="link" className="scan-tap h-10 w-full"><Link to="/panier" onClick={() => add(false)}><ShoppingCart className="mr-2 h-4 w-4" />Ajouter et voir le panier</Link></Button>
      </div>

      {r.verdict !== "none" && (
        <div className={`scan-verdict-in rounded-2xl p-4 ${v.cls}`}>
          <div className="text-lg font-extrabold">{v.title}</div>
          {gain != null && (
            <>
              <div className="text-2xl font-extrabold">{estimated ? "Gain estimé" : "Gain"} : {formatMoney(Math.round(animatedGain * 100) / 100)} / boîte</div>
              {minimumBoxCount != null && quantity < minimumBoxCount && mov != null && (
                <div className="mt-2 text-sm font-medium">
                  Gain réel à partir de {minimumBoxCount} boîtes (minimum de commande {formatMoney(mov)}), ou complétez avec d'autres produits de ce fournisseur.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {r.best_reference_price != null && r.references.length > 0 && (
        <div className="rounded-xl border bg-card p-3 space-y-1 text-sm">
          {r.references.map((x) => (
            <div key={x.source} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1">{x.label}{x.source !== "DECLARED" ? ` (−${String(x.discount_pct).replace(".", ",")} %)` : ""}</span>
              <span className="shrink-0">{formatMoney(x.net)}</span>
              {x.source === "DECLARED" && (
                <Button type="button" variant="link" size="sm" className="h-auto shrink-0 px-0" onClick={() => {
                  setDeclaredPrice(String(x.net).replace(".", ","));
                  setDeclaredSupplier(x.label.replace(/^Prix déclaré ·\s*/, ""));
                  setEditingDeclaredPrice(true);
                }}>Modifier</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {(r.verdict === "none" || editingDeclaredPrice) && (
        <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
          <div>
            <div className="font-semibold">Comparez avec votre prix d'achat</div>
            <div className="text-xs text-muted-foreground">Facultatif</div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prix HTVA</label>
            <Input inputMode="decimal" value={declaredPrice} onChange={(e) => setDeclaredPrice(e.target.value)} className="h-11 bg-card" placeholder="ex. 14,50" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Chez</label>
            <Select value={declaredSupplier} onValueChange={setDeclaredSupplier}>
              <SelectTrigger className="h-11 bg-card"><SelectValue placeholder="Grossiste ou labo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Febelco">Febelco</SelectItem>
                <SelectItem value="CERP Belgique">CERP Belgique</SelectItem>
                <SelectItem value="Cophana">Cophana</SelectItem>
                <SelectItem value="Pharma Belgium">Pharma Belgium</SelectItem>
                <SelectItem value="Phoenix">Phoenix</SelectItem>
                <SelectItem value="Laboratoire direct">Laboratoire direct</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="scan-tap h-11 w-full" onClick={compareDeclaredPrice} disabled={declaring}>
            {declaring ? <Loader2 className="h-5 w-5 animate-spin" /> : "Comparer"}
          </Button>
        </div>
      )}
      {!hasConditions && (
        <Button asChild variant="outline" className="scan-tap w-full"><Link to="/conditions">Ajouter mes conditions</Link></Button>
      )}
    </div>
  );
}

function NoOfferCard({ r, customerId, onResult }: { r: ScanResult; customerId: string; onResult: (result: ScanResult) => void }) {
  const unknown = !r.product;
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: matches = [], isFetching: searching } = useQuery({
    queryKey: ["scan-product-search", search],
    enabled: unknown && search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim().replace(/[,%()]/g, " ");
      const { data, error } = await sb.from("products")
        .select("id, name, brand_name, cnk_code, pack_size")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,brand_name.ilike.%${q}%,cnk_code.ilike.%${q}%`)
        .order("name").limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const chooseProduct = async (product: { id: string; cnk_code: string | null }) => {
    if (!product.cnk_code) { toast.error("Cette fiche n'a pas de CNK exploitable."); return; }
    setBusy(true);
    try {
      const { error } = await sb.rpc("scan_create_gtin_proposal", {
        _scan_event_id: r.scan_event_id,
        _product_id: product.id,
        _packaging_level: "unit",
        _units_per_pack: 1,
      });
      if (error) throw error;
      const resolved = await resolveScan({ raw_code: product.cnk_code, symbology: "manual_cnk", client_decode_ms: null });
      onResult(resolved);
      toast.success("Fiche trouvée · EAN envoyé pour validation");
    } catch (error) {
      console.error("scan product proposal failed", error);
      toast.error("Impossible de rattacher cette fiche, réessayez.");
    } finally { setBusy(false); }
  };

  const { data: rank } = useQuery({
    queryKey: ["scan-rank", r.scan_event_id],
    queryFn: async () => (await sb.rpc("scan_sourcing_week_rank", { _scan_event_id: r.scan_event_id })).data as number | null,
  });

  const submit = async () => {
    const q = qty.trim() ? Number(qty) : null;
    const p = price.trim() ? Number(price.replace(",", ".")) : null;
    if ((q != null && (!Number.isFinite(q) || q < 0)) || (p != null && (!Number.isFinite(p) || p < 0))) {
      toast.error("Quantité et prix doivent être positifs."); return;
    }
    setBusy(true);
    try {
      let photoPath: string | null = null;
      if (photo) {
        photoPath = `${customerId}/${r.scan_event_id}.jpg`;
        const { error } = await supabase.storage.from("scan-photos").upload(photoPath, photo, { contentType: photo.type || "image/jpeg", upsert: false });
        if (error) throw error;
      }
      const { error } = await sb.rpc("scan_submit_sourcing_request", {
        _scan_event_id: r.scan_event_id, _monthly_qty: q != null ? Math.round(q) : null, _current_price: p,
        _current_supplier: supplier || null, _photo_path: photoPath, _name: name || null,
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      console.error(e);
      toast.error("Envoi impossible, réessayez.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {!unknown && <ProductHead r={r} />}
      <div className="rounded-2xl verdict-none p-4 space-y-1">
        <div className="text-lg font-extrabold">{unknown ? "Code non reconnu — cherchez le produit" : "On le cherche pour vous"}</div>
        {rank != null && <div className="text-sm opacity-90">Vous êtes la {rank}{rank === 1 ? "re" : "e"} pharmacie à le chercher cette semaine.</div>}
      </div>
      {unknown && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 pl-10" placeholder="Nom, marque ou CNK" />
          </div>
          {searching && <div className="space-y-2" aria-hidden><div className="scan-skeleton h-10 w-full" /><div className="scan-skeleton h-10 w-full" /></div>}
          {matches.length > 0 && (
            <div className="divide-y rounded-lg border">
              {matches.map((product: any) => (
                <Button key={product.id} type="button" variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-3 text-left" disabled={busy} onClick={() => chooseProduct(product)}>
                  <span className="min-w-0">
                    <span className="block whitespace-normal font-medium">{product.name}</span>
                    <span className="block text-xs text-muted-foreground">{product.brand_name ?? ""}{product.cnk_code ? ` · CNK ${product.cnk_code}` : ""}</span>
                  </span>
                </Button>
              ))}
            </div>
          )}
          {search.trim().length >= 2 && !searching && matches.length === 0 && <p className="text-sm text-muted-foreground">Aucune fiche correspondante.</p>}
        </div>
      )}
      {sent ? (
        <div className="rounded-xl border bg-card p-4 text-sm">Merci, votre demande est enregistrée.</div>
      ) : (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          {unknown && (
            <>
              <div className="border-t pt-3">
                <div className="mb-2 font-semibold">Aucune fiche ne convient ?</div>
                <Input placeholder="Nom du produit" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              </div>
              <label className="scan-tap flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
                <Camera className="h-5 w-5" />{photo ? photo.name : "Photo de la boîte (facultatif)"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input inputMode="numeric" placeholder="Quantité / mois" value={qty} onChange={(e) => setQty(e.target.value)} className="h-11" />
            <Input inputMode="decimal" placeholder="Prix actuel HTVA" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11" />
          </div>
          <Input placeholder="Fournisseur actuel" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-11" />
          <Button className="scan-tap h-12 w-full text-base" onClick={submit} disabled={busy}>{busy ? "Envoi…" : "Envoyer la demande"}</Button>
        </div>
      )}
    </div>
  );
}
