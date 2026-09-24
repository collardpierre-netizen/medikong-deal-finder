import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flashlight, Keyboard, Loader2, Camera, X, Search, ShoppingCart, Settings2 } from "lucide-react";
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
const SCAN_COUNT_KEY = "mk_scan_count";
const A2HS_DONE_KEY = "mk_scan_a2hs_done";

function useA2hsPrompt() {
  const [show, setShow] = useState(false);
  const deferred = useRef<any>(null);
  useEffect(() => {
    const h = (e: any) => { e.preventDefault(); deferred.current = e; };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const bump = () => {
    const n = Number(localStorage.getItem(SCAN_COUNT_KEY) ?? 0) + 1;
    localStorage.setItem(SCAN_COUNT_KEY, String(n));
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (n >= 3 && !localStorage.getItem(A2HS_DONE_KEY) && !standalone) setShow(true);
  };
  const close = () => { localStorage.setItem(A2HS_DONE_KEY, "1"); setShow(false); };
  const install = async () => { if (deferred.current) { deferred.current.prompt(); await deferred.current.userChoice; } close(); };
  return { show, bump, close, install, canPrompt: () => !!deferred.current };
}

const VERDICT: Record<ScanResult["verdict"], { cls: string; title: string }> = {
  green: { cls: "verdict-green", title: "Vous avez déjà le meilleur prix" },
  orange: { cls: "verdict-orange", title: "MediKong est un peu moins cher" },
  red: { cls: "verdict-red", title: "MediKong est nettement moins cher" },
  none: { cls: "verdict-none", title: "Prix MediKong" },
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
  const a2hs = useA2hsPrompt();

  const { data: conditions = [] } = useQuery({
    queryKey: ["scan-conditions", customer.id],
    queryFn: async () => (await sb.from("pharmacist_wholesaler_settings")
      .select("id, is_supplier_of_pharmacist, override_rules_json").eq("customer_id", customer.id)).data ?? [],
  });
  const hasConditions = conditions.some((c: any) => c.is_supplier_of_pharmacist !== false);
  const estimated = conditions.some((c: any) => c.override_rules_json?.year_end_rebate || c.override_rules_json?.free_goods);

  const run = useCallback(async (raw: string, symbology: "ean13" | "datamatrix" | "manual_cnk" | "other", decodeMs: number | null) => {
    setBusy(true);
    try {
      const r = await resolveScan({ raw_code: raw, symbology, client_decode_ms: decodeMs });
      setResult(r);
      a2hs.bump();
    } catch {
      toast.error("Lecture impossible, réessayez.");
    } finally { setBusy(false); }
  }, [a2hs]);

  // Caméra active tant qu'aucun résultat n'est affiché
  useEffect(() => {
    if (result || manual) return;
    const s = createZxingScanner();
    scanner.current = s;
    s.onDetect((d) => { s.stop(); void run(d.text, d.symbology, d.decodeMs); });
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
          <Button asChild variant="secondary" size="sm" className="scan-tap">
            <Link to="/conditions"><Settings2 className="mr-1 h-4 w-4" />Mes conditions</Link>
          </Button>
        </div>
      </header>

      {a2hs.show && (
        <div className="mx-5 flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
          <span className="flex-1">
            {a2hs.canPrompt() ? "Ajoutez Scan à votre écran d'accueil." : "Ajoutez Scan à l'écran d'accueil : Partager → « Sur l'écran d'accueil »."}
          </span>
          {a2hs.canPrompt() && <Button size="sm" className="scan-tap" onClick={a2hs.install}>Ajouter</Button>}
          <Button size="icon" variant="ghost" className="scan-tap" aria-label="Fermer" onClick={a2hs.close}><X className="h-4 w-4" /></Button>
        </div>
      )}

      {!result && !manual && (
        <div className="px-5 space-y-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-scan-navy">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-xl border-2 border-primary" />
            {busy && <div className="absolute inset-0 flex items-center justify-center bg-scan-navy/60"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}
            {torchAvail && (
              <Button size="icon" variant="secondary" className="scan-tap absolute right-3 top-3" aria-label="Lampe" onClick={toggleTorch}>
                <Flashlight className="h-5 w-5" />
              </Button>
            )}
          </div>
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

      {result && (
        <div className="px-5 space-y-4">
          {result.product && result.best
            ? <VerdictCard r={result} customerId={customer.id} hasConditions={hasConditions} estimated={estimated} onResult={setResult} />
            : <NoOfferCard r={result} customerId={customer.id} />}
          <Button variant="outline" className="scan-tap h-12 w-full text-base" onClick={() => { setResult(null); setManual(false); setCnk(""); }}>
            <Camera className="mr-2 h-5 w-5" />Scanner un autre produit
          </Button>
        </div>
      )}
    </div>
  );
}

function ProductHead({ r }: { r: ScanResult }) {
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
    </div>
  );
}

function VerdictCard({ r, customerId, hasConditions, estimated, onResult }: { r: ScanResult; customerId: string; hasConditions: boolean; estimated: boolean; onResult: (r: ScanResult) => void }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [declaredPrice, setDeclaredPrice] = useState("");
  const [declaredSupplier, setDeclaredSupplier] = useState("");
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
  const vendorIds = vendorId ? [vendorId] : [];
  const { getMovForVendor } = useVendorMov(vendorIds);
  const mov = vendorId ? getMovForVendor(vendorId) : null;
  const subtotal = (r.best?.price ?? 0) * quantity;
  const movRemaining = mov != null ? Math.max(mov - subtotal, 0) : 0;
  const francoTarget = r.best?.franco ?? 250;
  const francoRemaining = Math.max(francoTarget - subtotal, 0);
  const v = VERDICT[r.verdict];
  const gain = r.delta != null && r.delta > 0 ? r.delta : null;
  const add = async () => {
    if (!r.best || !r.product) return;
    addToCart.mutate({
      offerId: r.best.offer_id, productId: r.product.id, quantity, maxQuantity: stockQuantity ?? undefined, vendorId, priceExclVat: r.best.price, deliveryDays: r.best.lead_time_days,
      productData: { id: r.product.id, name: r.product.name, brand: "", slug: "", price: r.best.price, imageUrl: r.product.image ?? undefined },
    });
    const { error } = await sb.from("scan_cart_attributions").insert({ customer_id: customerId, offer_id: r.best.offer_id, scan_event_id: r.scan_event_id });
    if (error) console.error("scan attribution failed", error.message);
    toast.success("Ajouté au panier");
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
      toast.success("Prix enregistré pour votre officine");
    } catch (error) {
      console.error("declared price failed", error);
      toast.error("Comparaison impossible, réessayez.");
    } finally { setDeclaring(false); }
  };
  return (
    <div className="space-y-3">
      <ProductHead r={r} />
      <div className={`rounded-2xl p-4 ${v.cls}`}>
        <div className="text-lg font-extrabold">{v.title}</div>
        {gain != null && (
          <div className="text-2xl font-extrabold">{estimated ? "Gain estimé" : "Gain"} : {formatMoney(gain)} / boîte</div>
        )}
        {r.verdict === "none" && <div className="text-sm opacity-90">Nous n'avons pas encore votre prix d'achat pour ce produit.</div>}
      </div>

      {r.verdict === "none" && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="font-bold">Vous le payez combien ?</div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prix HTVA</label>
            <Input inputMode="decimal" value={declaredPrice} onChange={(e) => setDeclaredPrice(e.target.value)} className="h-11" placeholder="ex. 14,50" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Chez</label>
            <Select value={declaredSupplier} onValueChange={setDeclaredSupplier}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Grossiste ou labo" /></SelectTrigger>
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
          <Button className="scan-tap h-12 w-full text-base" onClick={compareDeclaredPrice} disabled={declaring}>
            {declaring ? <Loader2 className="h-5 w-5 animate-spin" /> : "Comparer"}
          </Button>
        </div>
      )}

      {r.best_reference_price != null && (
        <div className="rounded-xl border bg-card p-3 space-y-1 text-sm">
          {r.references.length > 0 ? r.references.map((x) => (
            <div key={x.source} className="flex justify-between"><span>{x.label}{x.source !== "DECLARED" ? ` (−${String(x.discount_pct).replace(".", ",")} %)` : ""}</span><span>{formatMoney(x.net)}</span></div>
          )) : (
            <div className="flex justify-between"><span>Votre meilleur prix actuel</span><span className="font-semibold">{formatMoney(r.best_reference_price)}</span></div>
          )}
        </div>
      )}

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
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-sm font-medium">Quantité</span>
          <QuantityInput value={quantity} min={1} max={stockQuantity ?? undefined} onChange={setQuantity} />
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
        <Button className="scan-tap h-12 w-full text-base" onClick={add}><ShoppingCart className="mr-2 h-5 w-5" />Ajouter {quantity} au panier</Button>
      </div>
      {!hasConditions && (
        <Button asChild variant="outline" className="scan-tap w-full"><Link to="/conditions">Ajouter mes conditions</Link></Button>
      )}
    </div>
  );
}

function NoOfferCard({ r, customerId }: { r: ScanResult; customerId: string }) {
  const unknown = !r.product;
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

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
      <ProductHead r={r} />
      <div className="rounded-2xl verdict-none p-4 space-y-1">
        <div className="text-lg font-extrabold">On le cherche pour vous</div>
        {rank != null && <div className="text-sm opacity-90">Vous êtes la {rank}{rank === 1 ? "re" : "e"} pharmacie à le chercher cette semaine.</div>}
      </div>
      {sent ? (
        <div className="rounded-xl border bg-card p-4 text-sm">Merci, votre demande est enregistrée.</div>
      ) : (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          {unknown && (
            <>
              <Input placeholder="Nom du produit" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
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
