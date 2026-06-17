import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Check, X, MessageSquare, Send, Store } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { formatMoneyFromCents } from "@/lib/money-format";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", sent: "secondary", accepted: "default", declined: "destructive",
  expired: "outline", cancelled: "destructive", paid: "default", shipped: "default", completed: "default",
};

export default function OffresRecuesPage() {
  const { user } = useAuth();

  const buyerQ = useQuery({
    queryKey: ["my-buyer-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("buyers").select("id").eq("user_id", user!.id).eq("is_active", true).maybeSingle();
      return data as { id: string } | null;
    },
  });

  const listingsQ = useQuery({
    queryKey: ["my-p2p-received", buyerQ.data?.id],
    enabled: !!buyerQ.data?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buyer_p2p_listings")
        .select("*")
        .eq("target_buyer_id", buyerQ.data!.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Layout>
      <Helmet><title>Offres reçues · MediKong</title></Helmet>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Offres privées reçues</h1>
            <p className="text-sm text-muted-foreground">Propositions directes d'autres acheteurs de la plateforme.</p>
          </div>
          <Button asChild variant="outline"><Link to="/compte/ventes-privees"><Store className="w-4 h-4 mr-1" /> Mes ventes</Link></Button>
        </div>

        {listingsQ.isLoading ? <Loader2 className="animate-spin" /> : (
          <div className="space-y-3">
            {(listingsQ.data ?? []).map((l: any) => (
              <ListingRow key={l.id} listing={l} buyerId={buyerQ.data!.id} />
            ))}
            {(listingsQ.data ?? []).length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Aucune offre reçue.</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ListingRow({ listing: l, buyerId }: { listing: any; buyerId: string }) {
  const qc = useQueryClient();
  const [openMsg, setOpenMsg] = useState(false);

  const mut = useMutation({
    mutationFn: async (status: "accepted" | "declined") => {
      const { error } = await (supabase as any).from("buyer_p2p_listings").update({ status }).eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: (_v, status) => {
      toast.success(status === "accepted" ? "Offre acceptée" : "Offre refusée");
      qc.invalidateQueries({ queryKey: ["my-p2p-received"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = l.unit_price_excl_vat_cents * l.quantity;
  const totalTtc = Math.round(total * (1 + Number(l.vat_rate) / 100));
  const canAct = l.status === "sent";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>{l.status}</Badge>
              <span className="text-xs text-muted-foreground">Reçue {formatUpdatedAt(l.sent_at ?? l.created_at)} · Valide jusqu'au {formatUpdatedAt(l.valid_until)}</span>
            </div>
            <div className="font-medium">{l.product_name}</div>
            <div className="text-xs text-muted-foreground">
              {l.brand_name && <>{l.brand_name} · </>}
              {l.gtin && <>EAN {l.gtin} · </>}
              {l.cnk_code && <>CNK {l.cnk_code} · </>}
              {l.batch_number && <>Lot {l.batch_number} · </>}
              {l.expiry_date && <>Pér. {l.expiry_date}</>}
            </div>
            {l.notes && <div className="text-sm mt-2 p-2 bg-muted/30 rounded">{l.notes}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Qté {l.quantity}</div>
            <div className="font-bold">{formatMoneyFromCents(total)} HTVA</div>
            <div className="text-xs text-muted-foreground">{formatMoneyFromCents(totalTtc)} TVAC ({l.vat_rate}%)</div>
          </div>
        </div>

        {canAct && (
          <div className="flex gap-2 pt-3 border-t">
            <Button size="sm" onClick={() => mut.mutate("accepted")} disabled={mut.isPending}>
              <Check className="w-4 h-4 mr-1" /> Accepter
            </Button>
            <Button size="sm" variant="outline" onClick={() => mut.mutate("declined")} disabled={mut.isPending}>
              <X className="w-4 h-4 mr-1" /> Refuser
            </Button>
            <Dialog open={openMsg} onOpenChange={setOpenMsg}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost"><MessageSquare className="w-4 h-4 mr-1" /> Négocier</Button>
              </DialogTrigger>
              <NegotiateDialog listing={l} buyerId={buyerId} onDone={() => setOpenMsg(false)} />
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NegotiateDialog({ listing: l, buyerId, onDone }: { listing: any; buyerId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [counterQty, setCounterQty] = useState<string>("");
  const [counterPrice, setCounterPrice] = useState<string>("");

  const msgQ = useQuery({
    queryKey: ["p2p-msgs", l.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("buyer_p2p_messages").select("*").eq("listing_id", l.id).order("created_at");
      return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error("Message vide");
      const payload: any = {
        listing_id: l.id,
        author_buyer_id: buyerId,
        body: body.trim(),
        counter_quantity: counterQty ? parseInt(counterQty, 10) : null,
        counter_unit_price_excl_vat_cents: counterPrice ? Math.round(parseFloat(counterPrice) * 100) : null,
      };
      const { error } = await (supabase as any).from("buyer_p2p_messages").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setBody(""); setCounterQty(""); setCounterPrice("");
      toast.success("Message envoyé");
      qc.invalidateQueries({ queryKey: ["p2p-msgs", l.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Négocier — {l.product_name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="border rounded p-2 max-h-60 overflow-y-auto space-y-2 bg-muted/20">
          {(msgQ.data ?? []).map((m: any) => (
            <div key={m.id} className="text-sm">
              <div className="text-xs text-muted-foreground">{m.author_buyer_id === buyerId ? "Vous" : "Vendeur"} · {formatUpdatedAt(m.created_at)}</div>
              <div>{m.body}</div>
              {(m.counter_quantity != null || m.counter_unit_price_excl_vat_cents != null) && (
                <div className="text-xs text-primary">
                  Contre-offre : {m.counter_quantity != null && <>qté {m.counter_quantity}</>}{" "}
                  {m.counter_unit_price_excl_vat_cents != null && <> · {formatMoneyFromCents(m.counter_unit_price_excl_vat_cents)} HTVA</>}
                </div>
              )}
            </div>
          ))}
          {(msgQ.data ?? []).length === 0 && <div className="text-xs text-muted-foreground">Aucun message.</div>}
        </div>
        <Textarea rows={3} placeholder="Votre message…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" placeholder="Contre-qté (optionnel)" value={counterQty} onChange={(e) => setCounterQty(e.target.value)} />
          <Input type="number" step="0.01" placeholder="Contre-PU HTVA (optionnel)" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Envoyer
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
