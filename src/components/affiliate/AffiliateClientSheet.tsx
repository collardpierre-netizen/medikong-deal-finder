// Fiche client apporteur : coordonnées de contact + historique de commandes.
// N'expose aucune donnée de coût vendeur, commission MediKong ou marge.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Building2, Loader2, ShoppingBag, Truck } from "lucide-react";
import { useAffiliateAccount } from "@/hooks/useAffiliateAccount";
import { fmtCents, fmtDate } from "@/lib/affiliate-format";

type ClientSheet = {
  referral_id: string;
  pseudo: string;
  status: string;
  attributed_at: string | null;
  first_order_at: string | null;
  window_expires_at: string | null;
  client_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  customer_type: string | null;
  vat_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  preferred_language: string | null;
  is_verified: boolean | null;
  orders: Array<{
    order_id: string;
    order_number: string | null;
    created_at: string | null;
    status: string | null;
    payment_status: string | null;
    total_ht_cents: number | null;
    deliveries?: Array<{
      delivery_note_id: string;
      document_number: string | null;
      status: string | null;
      carrier: string | null;
      tracking_number: string | null;
      shipped_at: string | null;
      received_at: string | null;
      received_by: string | null;
      client_remarks: string | null;
      units: number | null;
    }> | null;
    delivery_summary?: {
      notes_count: number | null;
      received_count: number | null;
      last_received_at: string | null;
      last_shipped_at: string | null;
    } | null;
  }>;
  stats: { orders_count: number; revenue_ht_cents: number; last_order_at: string | null };
};

const TYPE_LABELS: Record<string, string> = {
  pharmacy: "Pharmacie",
  hospital: "Hôpital",
  doctor: "Médecin",
  wholesaler: "Grossiste",
  retailer: "Détaillant",
  other: "Client pro",
};

export default function AffiliateClientSheet({
  referralId,
  onClose,
}: {
  referralId: string | null;
  onClose: () => void;
}) {
  const { asAffiliateId } = useAffiliateAccount();

  const { data, isLoading, error } = useQuery<ClientSheet | null>({
    queryKey: ["affiliate-client-sheet", referralId, asAffiliateId],
    enabled: Boolean(referralId),
    queryFn: async () => {
      const args: Record<string, unknown> = { _referral_id: referralId };
      if (asAffiliateId) args._affiliate_id = asAffiliateId;
      const { data, error } = await (supabase as any).rpc("affiliate_my_client", args);
      if (error) throw error;
      return (data as ClientSheet) ?? null;
    },
  });

  const addr = data
    ? [data.address_line1, data.address_line2, [data.postal_code, data.city].filter(Boolean).join(" "), data.country]
        .filter(Boolean)
        .join(", ")
    : "";

  const deliveryRows = (data?.orders ?? []).flatMap((o) =>
    (o.deliveries ?? []).map((d) => ({ ...d, orderNumber: o.order_number }))
  );


  return (
    <Dialog open={Boolean(referralId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fiche client</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive py-4">
            Impossible d'afficher cette fiche client.
          </p>
        )}

        {data && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">{data.client_name ?? data.pseudo}</h2>
                {data.customer_type && (
                  <Badge variant="secondary">{TYPE_LABELS[data.customer_type] ?? data.customer_type}</Badge>
                )}
                {data.is_verified && <Badge className="bg-emerald-100 text-emerald-800">Vérifié</Badge>}
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-1">{data.pseudo}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {data.contact_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{data.contact_name}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${data.phone}`} className="underline hover:text-primary">{data.phone}</a>
                </div>
              )}
              {data.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${data.email}`} className="underline hover:text-primary truncate">{data.email}</a>
                </div>
              )}
              {addr && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{addr}</span>
                </div>
              )}
              {data.vat_number && (
                <div className="text-muted-foreground">TVA : {data.vat_number}</div>
              )}
              {data.preferred_language && (
                <div className="text-muted-foreground">Langue : {data.preferred_language.toUpperCase()}</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {data.phone && (
                <Button size="sm" asChild>
                  <a href={`tel:${data.phone}`}><Phone className="h-4 w-4 mr-1" /> Appeler</a>
                </Button>
              )}
              {data.email && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`mailto:${data.email}`}><Mail className="h-4 w-4 mr-1" /> Envoyer un email</a>
                </Button>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Commandes</p>
                <p className="font-semibold">{data.stats?.orders_count ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CA HTVA cumulé</p>
                <p className="font-semibold">{fmtCents(data.stats?.revenue_ht_cents ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dernière commande</p>
                <p className="font-semibold">{fmtDate(data.stats?.last_order_at ?? null)}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Historique des commandes</h3>
              </div>
              {data.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune commande enregistrée pour ce client.</p>
              ) : (
                <div className="divide-y border rounded-md">
                  {data.orders.map((o) => (
                    <div key={o.order_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{o.order_number ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(o.created_at)} · {o.status ?? "—"}
                        </p>
                      </div>
                      <span className="font-semibold shrink-0">{fmtCents(o.total_ht_cents ?? 0)} HT</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Suivi des livraisons</h3>
              </div>
              {deliveryRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune livraison enregistrée pour ce client.
                </p>
              ) : (
                <div className="divide-y border rounded-md">
                  {deliveryRows.map((d) => (
                    <div key={d.delivery_note_id} className="px-3 py-2 text-sm space-y-1">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-medium">{d.document_number ?? "Bon de livraison"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{d.orderNumber ?? "—"}</span>
                          {d.received_at ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Réception signée</Badge>
                          ) : d.status === "cancelled" ? (
                            <Badge variant="outline">Annulé</Badge>
                          ) : (
                            <Badge variant="secondary">En cours de livraison</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expédié le {fmtDate(d.shipped_at)}
                        {d.carrier ? ` · ${d.carrier}` : ""}
                        {d.tracking_number ? ` · suivi ${d.tracking_number}` : ""}
                        {d.units ? ` · ${d.units} unité(s)` : ""}
                      </p>
                      {d.received_at && (
                        <p className="text-xs text-emerald-700">
                          Reçu le {fmtDate(d.received_at)}
                          {d.received_by ? ` par ${d.received_by}` : ""}
                        </p>
                      )}
                      {d.client_remarks && (
                        <p className="text-xs text-muted-foreground italic">« {d.client_remarks} »</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>


            <p className="text-xs text-muted-foreground">
              Ces coordonnées vous sont communiquées pour accompagner votre client. Elles ne
              peuvent pas être utilisées à d'autres fins.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
