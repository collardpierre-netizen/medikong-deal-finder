import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Mail, Phone, MapPin, ShoppingBag, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { fmtEur } from "@/lib/format-currency";

const customerTypeLabel: Record<string, string> = {
  pharmacy: "Pharmacie",
  hospital: "Hôpital",
  doctor: "Médecin",
  wholesaler: "Grossiste",
  retailer: "Détaillant",
  other: "Client pro",
};

const statusLabel: Record<string, string> = {
  pending: "Nouvelle",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

interface BuyerProfileData {
  customer: {
    id: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    customer_type: string | null;
    vat_number: string | null;
    country: string | null;
    city: string | null;
  } | null;
  orders: Array<{
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    lines_count: number;
    total_excl_vat_cents: number;
  }>;
  stats: {
    orders_count: number;
    lines_count: number;
    total_excl_vat_cents: number;
    first_order_at: string | null;
    last_order_at: string | null;
  };
}

export default function VendorBuyerProfile() {
  const { customerId } = useParams<{ customerId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-buyer-profile", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<BuyerProfileData | null> => {
      const { data, error } = await supabase.rpc("get_vendor_buyer_profile", {
        _customer_id: customerId!,
      });
      if (error) throw error;
      return data as unknown as BuyerProfileData;
    },
  });

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5">
      <Link to="/vendor/orders">
        <ArrowLeft size={14} /> Retour aux commandes
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {backLink}
        <VCard className="p-10 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </VCard>
      </div>
    );
  }

  if (error || !data?.customer) {
    return (
      <div className="p-6 space-y-4">
        {backLink}
        <VCard className="p-8 text-center text-sm text-muted-foreground">
          Cet acheteur n'existe pas ou vous n'avez aucune commande avec lui.
        </VCard>
      </div>
    );
  }

  const { customer, orders, stats } = data;
  const typeLabel = customer.customer_type ? customerTypeLabel[customer.customer_type] : null;

  return (
    <div className="p-6 space-y-4">
      {backLink}

      <VCard className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">
                {customer.company_name || "Acheteur"}
              </h1>
              {typeLabel && <VBadge color="#475569">{typeLabel}</VBadge>}
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[13px] text-muted-foreground">
              {customer.email && (
                <div className="flex items-center gap-1.5">
                  <Mail size={13} />
                  <a href={`mailto:${customer.email}`} className="underline hover:text-primary truncate">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={13} />
                  <a href={`tel:${customer.phone}`} className="underline hover:text-primary">
                    {customer.phone}
                  </a>
                </div>
              )}
              {(customer.city || customer.country) && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  <span>{[customer.city, customer.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {customer.vat_number && (
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>TVA : {customer.vat_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </VCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <VCard className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Commandes</div>
          <div className="mt-1 text-xl font-bold text-foreground">{stats?.orders_count ?? 0}</div>
        </VCard>
        <VCard className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Lignes</div>
          <div className="mt-1 text-xl font-bold text-foreground">{stats?.lines_count ?? 0}</div>
        </VCard>
        <VCard className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wide">CA HT cumulé</div>
          <div className="mt-1 text-xl font-bold text-foreground">
            {fmtEur((stats?.total_excl_vat_cents ?? 0) / 100)} €
          </div>
        </VCard>
        <VCard className="p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wide">Dernière commande</div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {stats?.last_order_at
              ? format(new Date(stats.last_order_at), "dd MMM yyyy", { locale: fr })
              : "—"}
          </div>
        </VCard>
      </div>

      <VCard className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <ShoppingBag size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Historique des commandes</h2>
        </div>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune commande pour ce client.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((o) => (
              <Link
                key={o.id}
                to={`/vendor/commandes/${o.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{o.order_number}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {format(new Date(o.created_at), "dd MMM yyyy à HH:mm", { locale: fr })} ·{" "}
                    {o.lines_count} article{o.lines_count > 1 ? "s" : ""} ·{" "}
                    {statusLabel[o.status] || o.status}
                  </div>
                </div>
                <div className="text-sm font-bold text-foreground shrink-0">
                  {fmtEur(o.total_excl_vat_cents / 100)} € HT
                </div>
              </Link>
            ))}
          </div>
        )}
      </VCard>
    </div>
  );
}
