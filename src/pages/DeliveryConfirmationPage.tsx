import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, PackageX, Ban, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type LineStatus = "confirmed" | "partial" | "damaged" | "refused";

interface LineRow {
  id: string;
  quantity: number;
  unit_price_incl_vat: number;
  line_total_incl_vat: number;
  fulfillment_status: string;
  buyer_confirmation_status: LineStatus | null;
  buyer_confirmed_at: string | null;
  buyer_confirmed_quantity: number | null;
  buyer_confirmation_note: string | null;
  product: { name?: string; gtin?: string; cnk_code?: string } | null;
  vendor: { display_code?: string; name?: string } | null;
}
interface Payload {
  order: {
    id: string;
    order_number: string;
    status: string;
    delivery_confirmation_completed_at: string | null;
    customer: { company_name?: string; email?: string };
  };
  lines: LineRow[];
}
interface Draft {
  status: LineStatus | null;
  quantity_received: number | null;
  note: string;
}

const STATUS_LABEL: Record<LineStatus, { label: string; color: string; Icon: any }> = {
  confirmed: { label: "Conforme", color: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: CheckCircle2 },
  partial:   { label: "Partielle", color: "bg-amber-100 text-amber-800 border-amber-200", Icon: Package },
  damaged:   { label: "Endommagée", color: "bg-orange-100 text-orange-800 border-orange-200", Icon: PackageX },
  refused:   { label: "Refusée", color: "bg-red-100 text-red-800 border-red-200", Icon: Ban },
};

export default function DeliveryConfirmationPage() {
  const { token, id } = useParams<{ token?: string; id?: string }>();
  const [search] = useSearchParams();
  const authMode = !token && !!id;

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      const rpc = authMode
        ? supabase.rpc("buyer_get_delivery_confirmation_by_auth", { _order_id: id! })
        : supabase.rpc("buyer_get_delivery_confirmation", { _token: token! });
      const { data, error: err } = await rpc;
      if (cancel) return;
      if (err) {
        setError(err.message === "token_expired" ? "Ce lien a expiré." :
                 err.message === "invalid_token" ? "Ce lien n'est pas valide." :
                 err.message === "unauthorized" ? "Connectez-vous pour confirmer cette commande." :
                 err.message === "not_found_or_forbidden" ? "Commande introuvable." :
                 "Impossible de charger la commande.");
        setLoading(false);
        return;
      }
      const p = data as unknown as Payload;
      setPayload(p);
      const initial: Record<string, Draft> = {};
      for (const l of p.lines) {
        initial[l.id] = {
          status: l.buyer_confirmation_status,
          quantity_received: l.buyer_confirmed_quantity ?? (l.buyer_confirmation_status === "confirmed" ? l.quantity : null),
          note: l.buyer_confirmation_note ?? "",
        };
      }
      setDrafts(initial);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [token, id, authMode]);

  const alreadyCompleted = !!payload?.order.delivery_confirmation_completed_at;
  const linesPayload = useMemo(() => {
    if (!payload) return [];
    return payload.lines
      .filter((l) => drafts[l.id]?.status)
      .map((l) => ({
        line_id: l.id,
        status: drafts[l.id].status,
        quantity_received: drafts[l.id].quantity_received,
        note: drafts[l.id].note?.trim() || null,
      }));
  }, [drafts, payload]);

  const setLine = (id: string, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  const confirmAll = () => {
    if (!payload) return;
    const next: Record<string, Draft> = {};
    for (const l of payload.lines) {
      next[l.id] = { status: "confirmed", quantity_received: l.quantity, note: drafts[l.id]?.note ?? "" };
    }
    setDrafts(next);
  };

  const onSubmit = async () => {
    if (!payload || linesPayload.length === 0) return;
    setSubmitting(true);
    const rpc = authMode
      ? supabase.rpc("buyer_submit_delivery_confirmation_by_auth", { _order_id: id!, _lines: linesPayload as any })
      : supabase.rpc("buyer_submit_delivery_confirmation", { _token: token!, _lines: linesPayload as any });
    const { data, error: err } = await rpc;
    setSubmitting(false);
    if (err) {
      toast({ title: "Envoi impossible", description: err.message, variant: "destructive" });
      return;
    }
    toast({ title: "Merci !", description: `Confirmation enregistrée pour ${(data as any)?.updated_lines ?? linesPayload.length} ligne(s).` });
    // Recharger
    const rpc2 = authMode
      ? supabase.rpc("buyer_get_delivery_confirmation_by_auth", { _order_id: id! })
      : supabase.rpc("buyer_get_delivery_confirmation", { _token: token! });
    const { data: fresh } = await rpc2;
    if (fresh) setPayload(fresh as unknown as Payload);
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (error) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
          <h1 className="text-xl font-bold mb-2">Lien indisponible</h1>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }
  if (!payload) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Confirmer la réception</h1>
          <p className="text-muted-foreground mt-1">
            Commande <strong>{payload.order.order_number}</strong>
            {payload.order.customer?.company_name ? ` · ${payload.order.customer.company_name}` : ""}
          </p>
        </div>

        {alreadyCompleted && (
          <Card className="p-4 border-emerald-200 bg-emerald-50 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div className="text-sm">
              <div className="font-medium text-emerald-900">Confirmation déjà enregistrée</div>
              <div className="text-emerald-800">Vous pouvez toujours modifier une ligne si besoin.</div>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Marquez chaque ligne (conforme, partielle, endommagée, refusée) ou validez tout d'un coup.
          </p>
          <Button variant="outline" size="sm" onClick={confirmAll}>Tout marquer conforme</Button>
        </div>

        <div className="space-y-3">
          {payload.lines.map((l) => {
            const d = drafts[l.id] ?? { status: null, quantity_received: null, note: "" };
            const statusMeta = d.status ? STATUS_LABEL[d.status] : null;
            return (
              <Card key={l.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-navy truncate">{l.product?.name ?? "Produit"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {l.product?.cnk_code ? `CNK ${l.product.cnk_code} · ` : ""}
                      {l.product?.gtin ? `EAN ${l.product.gtin} · ` : ""}
                      Fournisseur {l.vendor?.display_code ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Qté commandée : <strong>{l.quantity}</strong> · Total TTC {Number(l.line_total_incl_vat).toFixed(2)} €
                    </div>
                  </div>
                  {statusMeta && (
                    <Badge variant="outline" className={statusMeta.color}>
                      <statusMeta.Icon className="w-3 h-3 mr-1" />{statusMeta.label}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(STATUS_LABEL) as LineStatus[]).map((s) => {
                    const meta = STATUS_LABEL[s];
                    const active = d.status === s;
                    return (
                      <Button
                        key={s}
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => setLine(l.id, {
                          status: s,
                          quantity_received: s === "confirmed" ? l.quantity : s === "refused" ? 0 : (d.quantity_received ?? l.quantity),
                        })}
                      >
                        <meta.Icon className="w-4 h-4 mr-2" />{meta.label}
                      </Button>
                    );
                  })}
                </div>

                {(d.status === "partial" || d.status === "damaged") && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground min-w-[120px]">Qté réellement reçue</label>
                    <Input
                      type="number"
                      min={0}
                      max={l.quantity}
                      value={d.quantity_received ?? ""}
                      onChange={(e) => setLine(l.id, { quantity_received: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">/ {l.quantity} commandée(s)</span>
                  </div>
                )}

                {d.status && d.status !== "confirmed" && (
                  <Textarea
                    placeholder="Précisez le problème (ex : 2 flacons cassés, DLU trop courte, produit manquant…)"
                    value={d.note}
                    onChange={(e) => setLine(l.id, { note: e.target.value })}
                    rows={2}
                    maxLength={500}
                  />
                )}
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-slate-50 pt-4 pb-2 -mx-4 px-4 border-t">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {linesPayload.length} ligne(s) sur {payload.lines.length} renseignée(s)
            </div>
            <Button size="lg" disabled={linesPayload.length === 0 || submitting} onClick={onSubmit}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer ma confirmation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
