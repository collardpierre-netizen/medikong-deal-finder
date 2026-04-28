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
            <Button size="sm" onClick={openNewVendor}><Plus size={14} className="mr-1" /> Ajouter un vendeur</Button>
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
              <Label>Logo (URL)</Label>
              <div className="flex items-center gap-3">
                {vf.logo_url ? (
                  <img
                    src={vf.logo_url}
                    alt="Aperçu logo"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-contain bg-white border"
                    style={{ borderColor: "#E2E8F0" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400 border" style={{ borderColor: "#E2E8F0" }}>—</div>
                )}
                <Input
                  className="flex-1"
                  value={vf.logo_url}
                  onChange={e => setVf(p => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://.../logo.png"
                />
              </div>
              <p className="text-[11px] mt-1" style={{ color: "#8B95A5" }}>URL d'image carrée (PNG/SVG). Affichée à côté de l'offre sur la fiche produit.</p>
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
  const [csvImporting, setCsvImporting] = useState(false);

  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split("\n");
    const header = lines[0].toLowerCase().split(",").map(s => s.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(s => s.trim());
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = vals[i] || ""; });
      return row;
    });

    // Match GTINs
    const gtins = rows.map(r => r.gtin).filter(Boolean);
    const { data: products } = await supabase.from("products").select("id, gtin, name").in("gtin", gtins);
    const gtinMap: Record<string, any> = {};
    (products || []).forEach(p => { if (p.gtin) gtinMap[p.gtin] = p; });

    const matched = rows.filter(r => gtinMap[r.gtin]).map(r => ({ ...r, product: gtinMap[r.gtin] }));
    const unmatched = rows.filter(r => !gtinMap[r.gtin]).map(r => r.gtin);
    setCsvPreview(matched);
    setCsvUnmatched(unmatched);
    setCsvDialog(true);
  };

  const importCsv = async () => {
    if (!csvPreview) return;
    setCsvImporting(true);
    const payloads = csvPreview.map(r => {
      const importedAt = (r.imported_at || "").trim();
      const parsedDate = importedAt ? new Date(importedAt) : null;
      const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
      return {
        external_vendor_id: vendor.id,
        product_id: r.product.id,
        unit_price: parseFloat(r.unit_price) || 0,
        mov_amount: parseFloat(r.mov) || 0,
        product_url: (r.product_url || "").trim(),
        stock_status: r.stock_status || "unknown",
        delivery_days: r.delivery_days ? parseInt(r.delivery_days) : null,
        ...(isValidDate ? { created_at: parsedDate!.toISOString() } : {}),
      };
    });
    const { error } = await supabase.from("external_offers").insert(payloads);
    setCsvImporting(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-external-offers", vendor.id] });
    setCsvDialog(false);
    setCsvPreview(null);
    toast.success(`${payloads.length} offres importées`);
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Import CSV — Aperçu</DialogTitle></DialogHeader>
          {csvPreview && (
            <div className="space-y-3">
              <p className="text-sm"><span className="font-semibold text-green-600">{csvPreview.length}</span> offres à créer</p>
              {csvUnmatched.length > 0 && (
                <p className="text-sm text-red-600"><span className="font-semibold">{csvUnmatched.length}</span> GTIN non trouvés : {csvUnmatched.slice(0, 5).join(", ")}{csvUnmatched.length > 5 ? "..." : ""}</p>
              )}
              <div className="max-h-60 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[11px]">Produit</TableHead><TableHead className="text-[11px]">Prix</TableHead><TableHead className="text-[11px]">MOV</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {csvPreview.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-[11px]">{r.product.name}</TableCell>
                        <TableCell className="text-[11px]">{r.unit_price} €</TableCell>
                        <TableCell className="text-[11px]">{r.mov || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button className="w-full" onClick={importCsv} disabled={csvImporting}>
                {csvImporting ? "Import en cours..." : `Importer ${csvPreview.length} offres`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
