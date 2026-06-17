import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Send, X, Inbox } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { formatMoneyFromCents } from "@/lib/money-format";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", sent: "secondary", accepted: "default", declined: "destructive",
  expired: "outline", cancelled: "destructive", paid: "default", shipped: "default", completed: "default",
};

type Listing = any;

export default function VentesPriveesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const buyerQ = useQuery({
    queryKey: ["my-buyer-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("buyers").select("id, pharmacy_name").eq("user_id", user!.id).eq("is_active", true).maybeSingle();
      return data as { id: string; pharmacy_name: string | null } | null;
    },
  });

  const listingsQ = useQuery({
    queryKey: ["my-p2p-sold", buyerQ.data?.id],
    enabled: !!buyerQ.data?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buyer_p2p_listings")
        .select("*")
        .eq("seller_buyer_id", buyerQ.data!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("buyer_p2p_listings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Annulée"); qc.invalidateQueries({ queryKey: ["my-p2p-sold"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Layout>
      <Helmet><title>Mes ventes privées · MediKong</title></Helmet>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mes ventes privées</h1>
            <p className="text-sm text-muted-foreground">Propositions directes envoyées à un autre acheteur de la plateforme.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/compte/offres-recues"><Inbox className="w-4 h-4 mr-1" /> Offres reçues</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={!buyerQ.data?.id}><Plus className="w-4 h-4 mr-1" /> Nouvelle vente</Button>
              </DialogTrigger>
              <CreateDialog sellerBuyerId={buyerQ.data?.id ?? ""} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["my-p2p-sold"] }); }} />
            </Dialog>
          </div>
        </div>

        {!buyerQ.data?.id ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Vous devez avoir un compte acheteur actif pour proposer une vente privée.</CardContent></Card>
        ) : listingsQ.isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <div className="space-y-3">
            {(listingsQ.data ?? []).map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>{l.status}</Badge>
                      <span className="text-xs text-muted-foreground">Valide jusqu'au {formatUpdatedAt(l.valid_until)}</span>
                    </div>
                    <div className="font-medium truncate">{l.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.brand_name && <>{l.brand_name} · </>}
                      {l.gtin && <>EAN {l.gtin} · </>}
                      {l.cnk_code && <>CNK {l.cnk_code} · </>}
                      Qté {l.quantity} × {formatMoneyFromCents(l.unit_price_excl_vat_cents)} HTVA = <b>{formatMoneyFromCents(l.unit_price_excl_vat_cents * l.quantity)}</b>
                    </div>
                  </div>
                  {(l.status === "draft" || l.status === "sent") && (
                    <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate(l.id)}><X className="w-4 h-4 mr-1" /> Annuler</Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {(listingsQ.data ?? []).length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Aucune vente privée envoyée.</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function CreateDialog({ sellerBuyerId, onDone }: { sellerBuyerId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    target_search: "",
    target_buyer_id: "",
    product_name: "",
    brand_name: "",
    gtin: "",
    cnk_code: "",
    quantity: 1,
    unit_price_excl_vat: 0,
    vat_rate: 21,
    batch_number: "",
    expiry_date: "",
    valid_days: 7,
    notes: "",
  });
  const [sendNow, setSendNow] = useState(true);

  const searchQ = useQuery({
    queryKey: ["p2p-buyer-search", form.target_search],
    enabled: form.target_search.length >= 2,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("buyers").select("id, pharmacy_name, vat_number")
        .ilike("pharmacy_name", `%${form.target_search}%`)
        .eq("is_active", true).neq("id", sellerBuyerId).limit(10);
      return (data ?? []) as { id: string; pharmacy_name: string; vat_number: string | null }[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.target_buyer_id) throw new Error("Destinataire requis");
      if (!form.product_name) throw new Error("Nom de produit requis");
      const valid_until = new Date(Date.now() + form.valid_days * 86400000).toISOString();
      const payload: any = {
        seller_buyer_id: sellerBuyerId,
        target_buyer_id: form.target_buyer_id,
        product_name: form.product_name,
        brand_name: form.brand_name || null,
        gtin: form.gtin || null,
        cnk_code: form.cnk_code || null,
        quantity: form.quantity,
        unit_price_excl_vat_cents: Math.round(form.unit_price_excl_vat * 100),
        vat_rate: form.vat_rate,
        valid_until,
        notes: form.notes || null,
        batch_number: form.batch_number || null,
        expiry_date: form.expiry_date || null,
        status: sendNow ? "sent" : "draft",
      };
      const { data, error } = await (supabase as any).from("buyer_p2p_listings").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (listing: any) => {
      if (sendNow && listing?.id) {
        const { notifyP2POfferReceived } = await import("@/lib/p2p-email");
        notifyP2POfferReceived(listing);
      }
      toast.success(sendNow ? "Envoyée" : "Brouillon créé");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nouvelle vente privée</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Destinataire (autre acheteur)</Label>
          <Input
            placeholder="Rechercher par nom de pharmacie…"
            value={form.target_search}
            onChange={(e) => setForm({ ...form, target_search: e.target.value, target_buyer_id: "" })}
          />
          {form.target_search.length >= 2 && !form.target_buyer_id && (
            <div className="border rounded mt-1 max-h-40 overflow-y-auto">
              {(searchQ.data ?? []).map((b) => (
                <button
                  key={b.id} type="button"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => setForm({ ...form, target_buyer_id: b.id, target_search: b.pharmacy_name ?? "" })}
                >
                  {b.pharmacy_name} {b.vat_number && <span className="text-xs text-muted-foreground">({b.vat_number})</span>}
                </button>
              ))}
              {searchQ.data?.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat.</div>}
            </div>
          )}
          {form.target_buyer_id && <Badge className="mt-1">Sélectionné</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Produit *</Label><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
          <div><Label>Marque</Label><Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} /></div>
          <div><Label>EAN/GTIN</Label><Input value={form.gtin} onChange={(e) => setForm({ ...form, gtin: e.target.value })} /></div>
          <div><Label>CNK</Label><Input value={form.cnk_code} onChange={(e) => setForm({ ...form, cnk_code: e.target.value })} /></div>
          <div><Label>Quantité *</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value || "1", 10) })} /></div>
          <div><Label>PU HTVA (€) *</Label><Input type="number" min={0} step="0.01" value={form.unit_price_excl_vat} onChange={(e) => setForm({ ...form, unit_price_excl_vat: parseFloat(e.target.value || "0") })} /></div>
          <div><Label>TVA (%)</Label><Input type="number" min={0} max={100} step="0.1" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: parseFloat(e.target.value || "0") })} /></div>
          <div><Label>N° lot</Label><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
          <div><Label>Péremption</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
          <div><Label>Validité (jours)</Label><Input type="number" min={1} max={90} value={form.valid_days} onChange={(e) => setForm({ ...form, valid_days: parseInt(e.target.value || "1", 10) })} /></div>
          <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
            Envoyer immédiatement
          </label>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            {createMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            {sendNow ? "Envoyer" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
