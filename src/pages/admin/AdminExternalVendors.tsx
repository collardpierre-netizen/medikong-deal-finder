import { useState, useRef } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plus, Pencil, Power, ExternalLink, Upload, Trash2, Search, Package, Download
} from "lucide-react";

/* ── Helpers ── */
function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ── Hook: external vendors ── */
function useExternalVendors() {
  return useQuery({
    queryKey: ["admin-external-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_vendors")
        .select("*")
        .order("name");
      if (error) throw error;
      // fetch offer counts
      const { data: counts } = await supabase
        .from("external_offers")
        .select("external_vendor_id")
        .eq("is_active", true);
      const countMap: Record<string, number> = {};
      (counts || []).forEach((c: any) => {
        countMap[c.external_vendor_id] = (countMap[c.external_vendor_id] || 0) + 1;
      });
      return (data || []).map((v: any) => ({ ...v, offer_count: countMap[v.id] || 0 }));
    },
  });
}

/* ── Hook: external offers for a vendor ── */
function useVendorExternalOffers(vendorId: string | null) {
  return useQuery({
    queryKey: ["admin-external-offers", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_offers")
        .select("*, products(name, gtin, slug)")
        .eq("external_vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });
}

/* ── Product search for offer creation ── */
function useProductSearch(term: string) {
  return useQuery({
    queryKey: ["product-search-ext", term],
    queryFn: async () => {
      if (term.length < 2) return [];
      const isGtin = /^\d{8,14}$/.test(term.trim());
      let query = supabase.from("products").select("id, name, gtin, cnk_code, slug").eq("is_active", true).limit(10);
      if (isGtin) {
        query = query.eq("gtin", term.trim());
      } else {
        query = query.ilike("name", `%${term}%`);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: term.length >= 2,
  });
}

export default function AdminExternalVendors() {
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useExternalVendors();
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [vendorDialog, setVendorDialog] = useState(false);
  const [editVendor, setEditVendor] = useState<any | null>(null);
  const [tab, setTab] = useState("list");

  // Vendor form
  const [vf, setVf] = useState({ name: "", website_url: "", logo_url: "", contact_email: "", contact_phone: "", country_code: "BE", notes: "" });
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const resetVf = () => setVf({ name: "", website_url: "", logo_url: "", contact_email: "", contact_phone: "", country_code: "BE", notes: "" });

  const openNewVendor = () => { resetVf(); setEditVendor(null); setVendorDialog(true); };
  const openEditVendor = (v: any) => {
    setVf({ name: v.name, website_url: v.website_url || "", logo_url: v.logo_url || "", contact_email: v.contact_email || "", contact_phone: v.contact_phone || "", country_code: v.country_code || "BE", notes: v.notes || "" });
    setEditVendor(v);
    setVendorDialog(true);
  };

  const saveVendor = useMutation({
    mutationFn: async () => {
      const payload = { ...vf, slug: slugify(vf.name) };
      if (editVendor) {
        const { error } = await supabase.from("external_vendors").update(payload).eq("id", editVendor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("external_vendors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-external-vendors"] }); setVendorDialog(false); toast.success("Vendeur sauvegardé"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleVendor = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await supabase.from("external_vendors").update({ is_active: !v.is_active }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-external-vendors"] }); toast.success("Statut mis à jour"); },
  });

  return (
    <div>
      <AdminTopBar title="Vendeurs externes" subtitle="Gestion des fournisseurs et offres externes" />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList style={{ backgroundColor: "#E2E8F0" }}>
            <TabsTrigger value="list" className="text-[13px]">Vendeurs</TabsTrigger>
            {selectedVendor && <TabsTrigger value="offers" className="text-[13px]">Offres — {selectedVendor.name}</TabsTrigger>}
          </TabsList>
          {tab === "list" && (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/admin/vendeurs-externes/audit-tva">Audit TVA</a>
              </Button>
              <Button size="sm" onClick={openNewVendor}><Plus size={14} className="mr-1" /> Ajouter un vendeur</Button>
            </div>
          )}
        </div>

        <TabsContent value="list">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Nom", "Site web", "Pays", "Offres actives", "Statut", "Actions"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</TableCell></TableRow>
                ) : vendors.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-[13px]" style={{ color: "#8B95A5" }}>Aucun vendeur externe</TableCell></TableRow>
                ) : vendors.map((v: any) => (
                  <TableRow key={v.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedVendor(v); setTab("offers"); }}>
                    <TableCell className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{v.name}</TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>
                      {v.website_url ? <a href={v.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>{v.website_url.replace(/https?:\/\//, "")} <ExternalLink size={10} /></a> : "—"}
                    </TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{v.country_code || "—"}</TableCell>
                    <TableCell className="text-[12px] font-semibold" style={{ color: "#1B5BDA" }}>{v.offer_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: v.is_active ? "#059669" : "#DC2626",
                        borderColor: v.is_active ? "#BBF7D0" : "#FCA5A5",
                        backgroundColor: v.is_active ? "#ECFDF5" : "#FEF2F2",
                      }}>{v.is_active ? "Actif" : "Inactif"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditVendor(v)}><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVendor.mutate(v)}><Power size={13} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="offers">
          {selectedVendor && <VendorOffersPanel vendor={selectedVendor} />}
        </TabsContent>
      </Tabs>

      {/* Vendor form dialog */}
      <Dialog open={vendorDialog} onOpenChange={setVendorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editVendor ? "Modifier" : "Ajouter"} un vendeur externe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={vf.name} onChange={e => setVf(p => ({ ...p, name: e.target.value }))} placeholder="Nom du vendeur" /></div>
            <div><Label>Site web</Label><Input value={vf.website_url} onChange={e => setVf(p => ({ ...p, website_url: e.target.value }))} placeholder="https://..." /></div>
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {vf.logo_url ? (
                  <img
                    src={vf.logo_url}
                    alt="Aperçu logo"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-lg object-contain bg-white border"
                    style={{ borderColor: "#E2E8F0" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400 border" style={{ borderColor: "#E2E8F0" }}>—</div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("Logo trop lourd (max 2 Mo)");
                          return;
                        }
                        try {
                          setLogoUploading(true);
                          const ext = (file.name.split(".").pop() || "png").toLowerCase();
                          const slug = slugify(vf.name || "vendor") || "vendor";
                          const path = `external-vendors/${slug}-${Date.now()}.${ext}`;
                          const { error: upErr } = await supabase.storage
                            .from("vendor-branding")
                            .upload(path, file, { upsert: true, contentType: file.type });
                          if (upErr) throw upErr;
                          const { data } = supabase.storage.from("vendor-branding").getPublicUrl(path);
                          setVf(p => ({ ...p, logo_url: data.publicUrl }));
                          toast.success("Logo téléversé");
                        } catch (err: any) {
                          toast.error("Échec upload : " + (err.message || "erreur inconnue"));
                        } finally {
                          setLogoUploading(false);
                          if (logoInputRef.current) logoInputRef.current.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {logoUploading ? "Envoi..." : (vf.logo_url ? "Remplacer" : "Téléverser")}
                    </Button>
                    {vf.logo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setVf(p => ({ ...p, logo_url: "" }))}
                        disabled={logoUploading}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Retirer
                      </Button>
                    )}
                  </div>
                  <Input
                    value={vf.logo_url}
                    onChange={e => setVf(p => ({ ...p, logo_url: e.target.value }))}
                    placeholder="ou collez une URL https://.../logo.png"
                    className="text-xs"
                  />
                </div>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "#8B95A5" }}>PNG/JPG/WebP/SVG carré, ≤ 2 Mo. Affiché à côté de l'offre sur la fiche produit.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={vf.contact_email} onChange={e => setVf(p => ({ ...p, contact_email: e.target.value }))} /></div>
              <div><Label>Téléphone</Label><Input value={vf.contact_phone} onChange={e => setVf(p => ({ ...p, contact_phone: e.target.value }))} /></div>
            </div>
            <div><Label>Pays</Label><Input value={vf.country_code} onChange={e => setVf(p => ({ ...p, country_code: e.target.value }))} placeholder="BE" /></div>
            <div><Label>Notes</Label><Input value={vf.notes} onChange={e => setVf(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={() => saveVendor.mutate()} disabled={!vf.name || saveVendor.isPending}>
              {saveVendor.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Vendor offers sub-panel ── */
function VendorOffersPanel({ vendor }: { vendor: any }) {
  const qc = useQueryClient();
  const { data: offers = [], isLoading } = useVendorExternalOffers(vendor.id);
  const [offerDialog, setOfferDialog] = useState(false);
  const [csvDialog, setCsvDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: searchResults = [] } = useProductSearch(searchTerm);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [of, setOf] = useState({ unit_price: "", mov_amount: "", product_url: "", stock_status: "unknown", delivery_days: "", notes: "" });

  const saveOffer = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Sélectionnez un produit");
      const payload = {
        external_vendor_id: vendor.id,
        product_id: selectedProduct.id,
        unit_price: parseFloat(of.unit_price),
        mov_amount: of.mov_amount ? parseFloat(of.mov_amount) : 0,
        product_url: of.product_url,
        stock_status: of.stock_status,
        delivery_days: of.delivery_days ? parseInt(of.delivery_days) : null,
        notes: of.notes || null,
      };
      const { error } = await supabase.from("external_offers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-external-offers", vendor.id] });
      setOfferDialog(false);
      setSelectedProduct(null);
      setOf({ unit_price: "", mov_amount: "", product_url: "", stock_status: "unknown", delivery_days: "", notes: "" });
      toast.success("Offre créée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOffer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("external_offers").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-external-offers", vendor.id] }); toast.success("Offre désactivée"); },
  });

  // CSV Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [csvUnmatched, setCsvUnmatched] = useState<string[]>([]);
  type InvalidRow = { row: number; gtin: string; unit_price: string; mov: string; reason: string };
  const [csvInvalid, setCsvInvalid] = useState<InvalidRow[]>([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ phase: string; processed: number; total: number; upserted: number; merged: number } | null>(null);

  // Récap post-import : doublons (vendor+product_id) détectés dans le CSV
  type DuplicateGroup = {
    productId: string;
    productName: string;
    gtin: string;
    kept: { lineIndex: number; unitPrice: number; mov: number; stockStatus: string };
    discarded: { lineIndex: number; unitPrice: number; mov: number; stockStatus: string }[];
  };
  const [importRecap, setImportRecap] = useState<{
    upserted: number;
    totalRows: number;
    duplicates: DuplicateGroup[];
  } | null>(null);

  // ── Helpers de normalisation CSV ──
  // Trim + suppression caractères invisibles + cast string
  const normStr = (v: unknown) =>
    String(v ?? "")
      .replace(/^\uFEFF/, "")          // BOM UTF-8
      .replace(/[\u200B-\u200D]/g, "") // zero-width
      .trim();

  // GTIN : ne garde que les chiffres (vire espaces, tirets, points, apostrophes)
  // Ne supprime PAS les zéros initiaux (un GTIN officiel peut commencer par 0).
  // Renvoie "" si le résultat n'est pas un nombre 8/12/13/14 chiffres plausible.
  const normGtin = (v: unknown) => {
    const digits = normStr(v).replace(/\D/g, "");
    if (!digits) return "";
    return digits;
  };

  // Variantes plausibles d'un GTIN pour rattraper du formatage incohérent en base
  // (ex: produits stockés en EAN-13 "0123456789012" alors que CSV envoie UPC-12 "123456789012")
  const gtinVariants = (g: string): string[] => {
    if (!g) return [];
    const out = new Set<string>([g]);
    // Padding à 13 ou 14
    if (g.length < 14) out.add(g.padStart(14, "0"));
    if (g.length < 13) out.add(g.padStart(13, "0"));
    if (g.length < 12) out.add(g.padStart(12, "0"));
    // Strip zéros initiaux (sans descendre sous 8)
    const stripped = g.replace(/^0+/, "");
    if (stripped.length >= 8) out.add(stripped);
    return Array.from(out);
  };

  // Numérique : accepte virgule décimale, espaces, devise. NaN → 0.
  const normNumber = (v: unknown) => {
    const s = normStr(v).replace(/[€$\s]/g, "").replace(",", ".");
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const normInt = (v: unknown): number | null => {
    const s = normStr(v).replace(/[^\d-]/g, "");
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const ALLOWED_STOCK = new Set(["in_stock", "low_stock", "out_of_stock", "on_request", "limited", "unknown"]);
  const normStockStatus = (v: unknown) => {
    const s = normStr(v).toLowerCase().replace(/[\s-]/g, "_");
    return ALLOWED_STOCK.has(s) ? s : "unknown";
  };

  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    // Strip BOM + supporte CRLF/CR/LF
    const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const lines = cleaned.trim().split("\n").filter(l => l.trim().length > 0);
    if (lines.length === 0) { toast.error("CSV vide"); return; }
    const header = lines[0].toLowerCase().split(",").map(s => normStr(s));

    type CsvRow = {
      gtin: string;
      unit_price: string;
      mov: string;
      product_url: string;
      stock_status: string;
      delivery_days: string;
      imported_at: string;
      _row: number;
      [k: string]: string | number;
    };

    const rows: CsvRow[] = lines.slice(1).map((line, idx) => {
      const vals = line.split(",").map(s => normStr(s));
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = vals[i] || ""; });
      // Normalisation au plus tôt → la clé `gtin` utilisée pour matching et dédoublonnage est canonique
      return {
        ...(row as any),
        gtin: normGtin(row.gtin),
        _row: idx + 2,
      } as CsvRow;
    });

    // Match GTINs avec variantes (rattrape padding/strip zéros)
    const allLookups = new Set<string>();
    rows.forEach(r => gtinVariants(r.gtin).forEach(g => allLookups.add(g)));
    const gtinList = Array.from(allLookups);

    const { data: products } = gtinList.length
      ? await supabase.from("products").select("id, gtin, name, category_id, categories(name)").in("gtin", gtinList)
      : { data: [] as any[] };

    const gtinMap: Record<string, any> = {};
    (products || []).forEach(p => { if (p.gtin) gtinMap[p.gtin] = p; });

    // Pour chaque ligne, trouve la 1re variante qui matche en base
    const resolveProduct = (g: string) => {
      for (const v of gtinVariants(g)) if (gtinMap[v]) return gtinMap[v];
      return null;
    };

    const matched: any[] = [];
    const invalid: InvalidRow[] = [];
    for (const r of rows) {
      const priceNum = normNumber(r.unit_price);
      if (!r.gtin) {
        invalid.push({ row: r._row, gtin: "", unit_price: String(r.unit_price ?? ""), mov: String(r.mov ?? ""), reason: "GTIN manquant" });
        continue;
      }
      if (!/^\d{8,14}$/.test(r.gtin)) {
        invalid.push({ row: r._row, gtin: r.gtin, unit_price: String(r.unit_price ?? ""), mov: String(r.mov ?? ""), reason: "GTIN invalide (8 à 14 chiffres attendus)" });
        continue;
      }
      if (!priceNum || priceNum <= 0) {
        invalid.push({ row: r._row, gtin: r.gtin, unit_price: String(r.unit_price ?? ""), mov: String(r.mov ?? ""), reason: "Prix unitaire invalide ou nul" });
        continue;
      }
      const product = resolveProduct(r.gtin);
      if (!product) {
        invalid.push({ row: r._row, gtin: r.gtin, unit_price: String(r.unit_price ?? ""), mov: String(r.mov ?? ""), reason: "GTIN introuvable dans le catalogue MediKong" });
        continue;
      }
      matched.push({ ...r, product });
    }
    const unmatched = invalid.filter(i => i.reason.startsWith("GTIN introuvable")).map(i => i.gtin);

    setCsvPreview(matched);
    setCsvUnmatched(unmatched);
    setCsvInvalid(invalid);
    setCsvTotalRows(rows.length);
    setCsvDialog(true);
  };

  const importCsv = async () => {
    if (!csvPreview) return;
    setCsvImporting(true);
    const totalRows = csvPreview.length;
    setCsvProgress({ phase: "Préparation des lignes", processed: 0, total: totalRows, upserted: 0, merged: 0 });
    // Yield to UI
    await new Promise(r => setTimeout(r, 30));

    const enriched: any[] = [];
    for (let i = 0; i < csvPreview.length; i++) {
      const r = csvPreview[i];
      const importedAt = normStr(r.imported_at);
      const parsedDate = importedAt ? new Date(importedAt) : null;
      const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
      enriched.push({
        external_vendor_id: vendor.id,
        product_id: r.product.id,
        _product_name: r.product.name as string,
        _product_gtin: (r.product.gtin || "") as string,
        _line_index: r._row as number,
        unit_price: normNumber(r.unit_price),
        mov_amount: normNumber(r.mov),
        product_url: normStr(r.product_url),
        stock_status: normStockStatus(r.stock_status),
        delivery_days: normInt(r.delivery_days),
        ...(isValidDate ? { created_at: parsedDate!.toISOString() } : {}),
      });
      // Update every 100 rows for smooth feedback without blocking
      if (i % 100 === 0) {
        setCsvProgress(p => p ? { ...p, processed: i + 1 } : p);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    setCsvProgress(p => p ? { ...p, processed: totalRows } : p);

    // Dédoublonnage
    const groups = new Map<string, typeof enriched>();
    enriched.forEach(p => {
      const key = `${p.external_vendor_id}::${p.product_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    });

    const duplicates: DuplicateGroup[] = [];
    const finalPayloads: any[] = [];
    groups.forEach(arr => {
      const kept = arr[arr.length - 1];
      const { _product_name, _product_gtin, _line_index, ...dbPayload } = kept;
      finalPayloads.push({
        ...dbPayload,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      if (arr.length > 1) {
        duplicates.push({
          productId: kept.product_id,
          productName: kept._product_name,
          gtin: kept._product_gtin,
          kept: {
            lineIndex: kept._line_index,
            unitPrice: kept.unit_price,
            mov: kept.mov_amount,
            stockStatus: kept.stock_status,
          },
          discarded: arr.slice(0, -1).map(d => ({
            lineIndex: d._line_index,
            unitPrice: d.unit_price,
            mov: d.mov_amount,
            stockStatus: d.stock_status,
          })),
        });
      }
    });

    const mergedCount = duplicates.reduce((acc, d) => acc + d.discarded.length, 0);
    setCsvProgress({
      phase: "Envoi vers la base",
      processed: totalRows,
      total: totalRows,
      upserted: 0,
      merged: mergedCount,
    });

    // Chunked upsert pour permettre une vraie barre de progression
    const CHUNK = 200;
    let upsertedSoFar = 0;
    for (let i = 0; i < finalPayloads.length; i += CHUNK) {
      const slice = finalPayloads.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("external_offers")
        .upsert(slice, { onConflict: "external_vendor_id,product_id" });
      if (error) {
        setCsvImporting(false);
        setCsvProgress(null);
        toast.error(error.message);
        return;
      }
      upsertedSoFar += slice.length;
      setCsvProgress(p => p ? { ...p, upserted: upsertedSoFar } : p);
      await new Promise(r => setTimeout(r, 0));
    }

    setCsvImporting(false);
    setCsvProgress(null);
    qc.invalidateQueries({ queryKey: ["admin-external-offers", vendor.id] });
    setCsvDialog(false);
    setCsvPreview(null);
    setImportRecap({
      upserted: finalPayloads.length,
      totalRows: enriched.length,
      duplicates,
    });
    toast.success(`${finalPayloads.length} offres importées${mergedCount ? ` (${mergedCount} doublons fusionnés)` : ""}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold" style={{ color: "#1D2530" }}>Offres de {vendor.name}</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
              const csv = [
                "gtin,unit_price,mov,product_url,stock_status,delivery_days,imported_at",
                `5400123456789,12.50,150,https://vendeur.com/produit-x,in_stock,3,${today}`,
                `3400934567812,8.90,100,https://vendeur.com/produit-y,limited,5,${today}`,
                `5012345678900,4.20,50,https://vendeur.com/produit-z,out_of_stock,,${today}`,
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `modele-import-offres-externes-${today}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success("Modèle CSV téléchargé");
            }}
            title="Télécharger un modèle CSV (gtin, unit_price, mov, product_url, stock_status, delivery_days, imported_at)"
          >
            <Download size={14} className="mr-1" /> Modèle CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={14} className="mr-1" /> Importer CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); e.target.value = ""; }} />
          <Button size="sm" onClick={() => setOfferDialog(true)}><Plus size={14} className="mr-1" /> Ajouter une offre</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#F8FAFC" }}>
              {["Produit", "GTIN", "Prix", "MOV", "Stock", "Délai", "Actions"].map(h => (
                <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</TableCell></TableRow>
            ) : offers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[13px]" style={{ color: "#8B95A5" }}>Aucune offre</TableCell></TableRow>
            ) : offers.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{(o.products as any)?.name || "—"}</TableCell>
                <TableCell className="text-[11px] font-mono" style={{ color: "#616B7C" }}>{(o.products as any)?.gtin || "—"}</TableCell>
                <TableCell className="text-[12px] font-semibold" style={{ color: "#059669" }}>{Number(o.unit_price).toFixed(2)} €</TableCell>
                <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{Number(o.mov_amount || 0) > 0 ? `${Number(o.mov_amount).toFixed(0)} €` : "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: o.stock_status === "in_stock" ? "#059669" : o.stock_status === "limited" ? "#F59E0B" : "#8B95A5",
                  }}>
                    {o.stock_status === "in_stock" ? "🟢 En stock" : o.stock_status === "limited" ? "🟡 Limité" : o.stock_status === "out_of_stock" ? "🔴 Rupture" : "⚪ Inconnu"}
                  </Badge>
                </TableCell>
                <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{o.delivery_days ? `${o.delivery_days}j` : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {o.product_url && <a href={o.product_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink size={13} /></Button></a>}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteOffer.mutate(o.id)}><Trash2 size={13} /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add offer dialog */}
      <Dialog open={offerDialog} onOpenChange={setOfferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajouter une offre externe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rechercher un produit (GTIN, nom ou CNK)</Label>
              <Input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); }} placeholder="Tapez pour rechercher..." />
              {searchResults.length > 0 && !selectedProduct && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {searchResults.map((p: any) => (
                    <button key={p.id} className="w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 border-b last:border-b-0" onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); }}>
                      <span className="font-medium">{p.name}</span>
                      {p.gtin && <span className="ml-2 text-muted-foreground font-mono">{p.gtin}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && <p className="text-[11px] text-green-600 mt-1">✓ {selectedProduct.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prix unitaire (€) *</Label><Input type="number" step="0.01" value={of.unit_price} onChange={e => setOf(p => ({ ...p, unit_price: e.target.value }))} /></div>
              <div><Label>MOV (€)</Label><Input type="number" step="0.01" value={of.mov_amount} onChange={e => setOf(p => ({ ...p, mov_amount: e.target.value }))} /></div>
            </div>
            <div><Label>URL produit *</Label><Input value={of.product_url} onChange={e => setOf(p => ({ ...p, product_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Statut stock</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={of.stock_status} onChange={e => setOf(p => ({ ...p, stock_status: e.target.value }))}>
                  <option value="unknown">Inconnu</option>
                  <option value="in_stock">En stock</option>
                  <option value="limited">Stock limité</option>
                  <option value="out_of_stock">Rupture</option>
                </select>
              </div>
              <div><Label>Délai (jours)</Label><Input type="number" value={of.delivery_days} onChange={e => setOf(p => ({ ...p, delivery_days: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Input value={of.notes} onChange={e => setOf(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={() => saveOffer.mutate()} disabled={!selectedProduct || !of.unit_price || !of.product_url || saveOffer.isPending}>
              {saveOffer.isPending ? "Enregistrement..." : "Créer l'offre"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV import preview dialog */}
      <Dialog open={csvDialog} onOpenChange={setCsvDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import CSV — Récapitulatif avant soumission</DialogTitle></DialogHeader>
          {csvPreview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-[11px] text-muted-foreground">Lignes lues</div>
                  <div className="text-lg font-semibold">{csvTotalRows}</div>
                </div>
                <div className="rounded-md border p-3 border-green-200 bg-green-50/40">
                  <div className="text-[11px] text-green-700">Valides</div>
                  <div className="text-lg font-semibold text-green-700">{csvPreview.length}</div>
                </div>
                <div className="rounded-md border p-3 border-red-200 bg-red-50/40">
                  <div className="text-[11px] text-red-700">Invalides</div>
                  <div className="text-lg font-semibold text-red-700">{csvInvalid.length}</div>
                </div>
              </div>

              <Tabs defaultValue={csvInvalid.length > 0 ? "invalid" : "valid"}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="valid">Valides ({csvPreview.length})</TabsTrigger>
                  <TabsTrigger value="invalid">Invalides ({csvInvalid.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="valid">
                  {csvPreview.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">Aucune ligne valide à importer.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="text-[11px]">Produit</TableHead>
                          <TableHead className="text-[11px]">Catégorie suggérée</TableHead>
                          <TableHead className="text-[11px]">Prix</TableHead>
                          <TableHead className="text-[11px]">MOV</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {csvPreview.slice(0, 20).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-[11px]">{r.product.name}</TableCell>
                              <TableCell className="text-[11px]">
                                {r.product.categories?.name ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]">
                                    {r.product.categories.name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-[11px]">{r.unit_price} €</TableCell>
                              <TableCell className="text-[11px]">{r.mov || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {csvPreview.length > 20 && (
                        <p className="text-[11px] text-muted-foreground p-2 text-center">… et {csvPreview.length - 20} autres lignes valides</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="invalid">
                  {csvInvalid.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">Aucune erreur détectée.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground">{csvInvalid.length} ligne(s) seront ignorées à l'import.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const header = "row,gtin,unit_price,mov,reason";
                            const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
                            const body = csvInvalid.map(r => [r.row, escape(r.gtin), escape(r.unit_price), escape(r.mov), escape(r.reason)].join(",")).join("\n");
                            const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `erreurs-import-${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                          }}
                        >
                          <Download size={12} className="mr-1" /> Télécharger erreurs CSV
                        </Button>
                      </div>
                      <div className="max-h-60 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-[11px]">Ligne</TableHead>
                            <TableHead className="text-[11px]">GTIN</TableHead>
                            <TableHead className="text-[11px]">Prix</TableHead>
                            <TableHead className="text-[11px]">Motif</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {csvInvalid.slice(0, 50).map((r, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-[11px] font-mono">{r.row}</TableCell>
                                <TableCell className="text-[11px] font-mono">{r.gtin || "—"}</TableCell>
                                <TableCell className="text-[11px]">{r.unit_price || "—"}</TableCell>
                                <TableCell className="text-[11px] text-red-600">{r.reason}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {csvInvalid.length > 50 && (
                          <p className="text-[11px] text-muted-foreground p-2 text-center">… et {csvInvalid.length - 50} autres erreurs (visibles dans l'export CSV)</p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Button className="w-full" onClick={importCsv} disabled={csvImporting || csvPreview.length === 0}>
                {csvImporting ? "Import en cours..." : `Confirmer et importer ${csvPreview.length} offre(s)`}
              </Button>
              {csvProgress && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <span>{csvProgress.phase}</span>
                    <span className="text-muted-foreground">
                      {csvProgress.phase === "Envoi vers la base"
                        ? `${csvProgress.upserted} / ${csvProgress.total - csvProgress.merged}`
                        : `${csvProgress.processed} / ${csvProgress.total}`}
                    </span>
                  </div>
                  <Progress
                    value={
                      csvProgress.phase === "Envoi vers la base"
                        ? Math.round((csvProgress.upserted / Math.max(1, csvProgress.total - csvProgress.merged)) * 100)
                        : Math.round((csvProgress.processed / Math.max(1, csvProgress.total)) * 100)
                    }
                  />
                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="rounded bg-background px-2 py-1 border">
                      <div className="text-muted-foreground">Traitées</div>
                      <div className="font-semibold">{csvProgress.processed}</div>
                    </div>
                    <div className="rounded bg-background px-2 py-1 border">
                      <div className="text-muted-foreground">Importées</div>
                      <div className="font-semibold text-green-600">{csvProgress.upserted}</div>
                    </div>
                    <div className="rounded bg-background px-2 py-1 border">
                      <div className="text-muted-foreground">Fusionnées</div>
                      <div className="font-semibold text-amber-600">{csvProgress.merged}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Récap post-import : doublons (vendor + product_id) détectés ── */}
      <Dialog open={!!importRecap} onOpenChange={(o) => !o && setImportRecap(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import terminé — Récapitulatif</DialogTitle>
          </DialogHeader>
          {importRecap && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground uppercase">Lignes CSV</p>
                  <p className="text-xl font-bold">{importRecap.totalRows}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground uppercase">Offres en base</p>
                  <p className="text-xl font-bold text-green-600">{importRecap.upserted}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground uppercase">Doublons fusionnés</p>
                  <p className="text-xl font-bold text-amber-600">{importRecap.duplicates.length}</p>
                </div>
              </div>

              {importRecap.duplicates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun doublon détecté. Chaque produit n'apparaissait qu'une fois dans le CSV.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Pour chaque produit présent plusieurs fois dans le CSV, c'est la <strong>dernière ligne</strong> qui a été conservée
                    (les autres ont été ignorées). Vérifiez que c'est bien le comportement attendu.
                  </p>
                  <div className="max-h-[400px] overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Produit</TableHead>
                          <TableHead className="text-[11px]">GTIN</TableHead>
                          <TableHead className="text-[11px]">Conservée</TableHead>
                          <TableHead className="text-[11px]">Ignorées</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRecap.duplicates.map((d) => (
                          <TableRow key={d.productId}>
                            <TableCell className="text-[11px] max-w-[220px] truncate" title={d.productName}>
                              {d.productName}
                            </TableCell>
                            <TableCell className="text-[11px] font-mono">{d.gtin || "—"}</TableCell>
                            <TableCell className="text-[11px]">
                              <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-white text-[10px] mr-1">
                                Ligne {d.kept.lineIndex}
                              </Badge>
                              <span className="text-muted-foreground">
                                {d.kept.unitPrice.toFixed(2)} € · {d.kept.stockStatus}
                              </span>
                            </TableCell>
                            <TableCell className="text-[11px]">
                              <div className="flex flex-col gap-1">
                                {d.discarded.map((x, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10px] line-through opacity-70">
                                      Ligne {x.lineIndex}
                                    </Badge>
                                    <span className="text-muted-foreground line-through opacity-70">
                                      {x.unitPrice.toFixed(2)} € · {x.stockStatus}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {importRecap.duplicates.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const csv = [
                        "product_name,gtin,kept_line,kept_price,kept_stock,discarded_lines",
                        ...importRecap.duplicates.map((d) =>
                          [
                            `"${d.productName.replace(/"/g, '""')}"`,
                            d.gtin,
                            d.kept.lineIndex,
                            d.kept.unitPrice.toFixed(2),
                            d.kept.stockStatus,
                            `"${d.discarded.map((x) => `L${x.lineIndex}@${x.unitPrice.toFixed(2)}`).join(" | ")}"`,
                          ].join(",")
                        ),
                      ].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `import-doublons-${vendor.slug || "vendor"}-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={14} className="mr-1.5" /> Exporter les doublons
                  </Button>
                )}
                <Button onClick={() => setImportRecap(null)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
