import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { formatMoneyFromCents } from "@/lib/money-format";

type Settings = {
  default_commission_bps: number;
  commission_payer: "seller" | "buyer" | "split";
  max_validity_days: number;
  is_enabled: boolean;
};

type Listing = {
  id: string;
  status: string;
  product_name: string;
  brand_name: string | null;
  gtin: string | null;
  cnk_code: string | null;
  quantity: number;
  unit_price_excl_vat_cents: number;
  vat_rate: number;
  currency_code: string;
  valid_until: string;
  created_at: string;
  seller_buyer_id: string;
  target_buyer_id: string;
  commission_enabled: boolean;
  commission_rate_bps: number;
  commission_payer: string;
  notes: string | null;
};

type Message = {
  id: string;
  body: string;
  author_buyer_id: string;
  counter_unit_price_excl_vat_cents: number | null;
  counter_quantity: number | null;
  created_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  accepted: "default",
  declined: "destructive",
  expired: "outline",
  cancelled: "destructive",
  paid: "default",
  shipped: "default",
  completed: "default",
};

export default function AdminP2PSalesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Listing | null>(null);

  const settingsQ = useQuery({
    queryKey: ["admin-p2p-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("buyer_p2p_settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as Settings;
    },
  });

  const listingsQ = useQuery({
    queryKey: ["admin-p2p-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buyer_p2p_listings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const buyerIds = Array.from(
    new Set((listingsQ.data ?? []).flatMap((l) => [l.seller_buyer_id, l.target_buyer_id])),
  );
  const buyersQ = useQuery({
    queryKey: ["admin-p2p-buyers", buyerIds.sort().join(",")],
    enabled: buyerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buyers")
        .select("id, pharmacy_name")
        .in("id", buyerIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const b of data ?? []) map[b.id] = b.pharmacy_name ?? b.id.slice(0, 6);
      return map;
    },
  });

  const messagesQ = useQuery({
    queryKey: ["admin-p2p-messages", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buyer_p2p_messages")
        .select("*")
        .eq("listing_id", selected!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await (supabase as any).from("buyer_p2p_settings").update(patch).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-p2p-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const s = settingsQ.data;

  return (
    <div className="p-6 space-y-6">
      <Helmet><title>Ventes privées P2P · Admin</title></Helmet>
      <h1 className="text-2xl font-bold">Ventes privées entre acheteurs</h1>

      <Card>
        <CardHeader><CardTitle>Paramètres globaux</CardTitle></CardHeader>
        <CardContent>
          {settingsQ.isLoading || !s ? (
            <Loader2 className="animate-spin" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={s.is_enabled}
                  onCheckedChange={(v) => updateSettings.mutate({ is_enabled: v })}
                />
                <Label>Module activé</Label>
              </div>
              <div>
                <Label>Commission par défaut (%)</Label>
                <Input
                  type="number" min={0} max={100} step="0.1"
                  defaultValue={(s.default_commission_bps / 100).toString()}
                  onBlur={(e) => {
                    const bps = Math.round(parseFloat(e.target.value || "0") * 100);
                    if (bps !== s.default_commission_bps) updateSettings.mutate({ default_commission_bps: bps });
                  }}
                />
              </div>
              <div>
                <Label>Payeur commission</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 text-sm"
                  value={s.commission_payer}
                  onChange={(e) => updateSettings.mutate({ commission_payer: e.target.value as any })}
                >
                  <option value="seller">Vendeur</option>
                  <option value="buyer">Acheteur</option>
                  <option value="split">Partagée</option>
                </select>
              </div>
              <div>
                <Label>Validité max (jours)</Label>
                <Input
                  type="number" min={1} max={90}
                  defaultValue={s.max_validity_days}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value || "0", 10);
                    if (v !== s.max_validity_days) updateSettings.mutate({ max_validity_days: v });
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Ventes privées ({listingsQ.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listingsQ.isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Vendeur</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">PU HTVA</TableHead>
                  <TableHead className="text-right">Total HTVA</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listingsQ.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatUpdatedAt(l.created_at)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[l.status] ?? "outline"}>{l.status}</Badge></TableCell>
                    <TableCell className="text-xs">{buyersQ.data?.[l.seller_buyer_id] ?? "…"}</TableCell>
                    <TableCell className="text-xs">{buyersQ.data?.[l.target_buyer_id] ?? "…"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{l.product_name}</TableCell>
                    <TableCell className="text-right">{l.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoneyFromCents(l.unit_price_excl_vat_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoneyFromCents(l.unit_price_excl_vat_cents * l.quantity)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(l)}><Eye className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(listingsQ.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucune vente privée.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Vente privée — détail</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Statut :</span> <Badge>{selected.status}</Badge></div>
                <div><span className="text-muted-foreground">Valide jusqu'au :</span> {formatUpdatedAt(selected.valid_until)}</div>
                <div><span className="text-muted-foreground">Produit :</span> {selected.product_name}</div>
                <div><span className="text-muted-foreground">Marque :</span> {selected.brand_name ?? "—"}</div>
                <div><span className="text-muted-foreground">GTIN :</span> {selected.gtin ?? "—"}</div>
                <div><span className="text-muted-foreground">CNK :</span> {selected.cnk_code ?? "—"}</div>
                <div><span className="text-muted-foreground">Quantité :</span> {selected.quantity}</div>
                <div><span className="text-muted-foreground">PU HTVA :</span> {formatMoneyFromCents(selected.unit_price_excl_vat_cents)}</div>
                <div><span className="text-muted-foreground">TVA :</span> {selected.vat_rate}%</div>
                <div><span className="text-muted-foreground">Commission :</span> {selected.commission_enabled ? `${selected.commission_rate_bps / 100}% (${selected.commission_payer})` : "—"}</div>
              </div>
              {selected.notes && (
                <div><div className="text-muted-foreground text-xs mb-1">Notes</div><div className="border rounded p-2 bg-muted/30">{selected.notes}</div></div>
              )}
              <div>
                <div className="text-muted-foreground text-xs mb-2">Messages ({messagesQ.data?.length ?? 0})</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(messagesQ.data ?? []).map((m) => (
                    <div key={m.id} className="border rounded p-2">
                      <div className="text-xs text-muted-foreground">{buyersQ.data?.[m.author_buyer_id] ?? m.author_buyer_id.slice(0, 6)} · {formatUpdatedAt(m.created_at)}</div>
                      <div>{m.body}</div>
                      {(m.counter_unit_price_excl_vat_cents != null || m.counter_quantity != null) && (
                        <div className="text-xs text-primary mt-1">
                          Contre-offre : {m.counter_quantity != null && `qté ${m.counter_quantity}`}{" "}
                          {m.counter_unit_price_excl_vat_cents != null && ` · ${formatMoneyFromCents(m.counter_unit_price_excl_vat_cents)} HTVA`}
                        </div>
                      )}
                    </div>
                  ))}
                  {(messagesQ.data ?? []).length === 0 && (
                    <div className="text-muted-foreground text-xs">Aucun message.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
