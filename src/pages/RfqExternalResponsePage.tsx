import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

type InvitationStatus = "invited" | "viewed" | "responded" | "declined" | "expired";

interface InvitationData {
  invitation: {
    id: string;
    status: InvitationStatus;
    contact_email: string;
    contact_name: string | null;
    token_expires_at: string;
    responded_at: string | null;
  };
  rfq: {
    id: string;
    status: string;
    product_name: string | null;
    brand_name: string | null;
    quantity: number;
    target_price_excl_vat_cents: number | null;
    currency_code: string | null;
    destination_country_code: string;
    responses_deadline: string;
    desired_delivery_date: string | null;
    payment_terms: string | null;
    required_offer_validity_days: number | null;
    comment: string | null;
  };
  vendor: {
    id: string;
    name: string;
    logo_url: string | null;
    country_code: string | null;
  };
  response: any | null;
}

function fmtCents(c: number | null | undefined, currency = "EUR"): string {
  if (c == null) return "—";
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency }).format(c / 100);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RfqExternalResponsePage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["rfq-external-invitation", token],
    queryFn: async () => {
      if (!token) throw new Error("Token manquant");
      const { data, error } = await supabase.rpc("rfq_external_get_invitation" as never, { _token: token } as never);
      if (error) throw error;
      const result = data as any;
      if (result?.error === "not_found") throw new Error("Invitation introuvable");
      if (result?.error === "expired") throw new Error("Invitation expirée");
      return result as InvitationData;
    },
    enabled: !!token,
    retry: false,
  });

  // Form state
  const [unitPrice, setUnitPrice] = useState("");
  const [quantityAvail, setQuantityAvail] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [validity, setValidity] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [comment, setComment] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");

  useEffect(() => {
    if (!data) return;
    const r = data.response;
    if (r) {
      setUnitPrice((r.unit_price_excl_vat_cents / 100).toFixed(2));
      setQuantityAvail(r.quantity_available?.toString() ?? "");
      setLeadTime(r.lead_time_days?.toString() ?? "");
      setValidity(r.validity_days?.toString() ?? "");
      setPaymentTerms(r.payment_terms ?? "");
      setComment(r.comment ?? "");
      setContactEmail(r.contact_email ?? data.invitation.contact_email);
      setContactName(r.contact_name ?? data.invitation.contact_name ?? "");
    } else {
      setContactEmail(data.invitation.contact_email);
      setContactName(data.invitation.contact_name ?? "");
      if (data.rfq.required_offer_validity_days) setValidity(String(data.rfq.required_offer_validity_days));
      if (data.rfq.payment_terms) setPaymentTerms(data.rfq.payment_terms);
    }
  }, [data]);

  const submitMut = useMutation({
    mutationFn: async (decline: boolean) => {
      if (!token) throw new Error("Token manquant");
      const priceFloat = parseFloat(unitPrice.replace(",", "."));
      if (!decline && (!isFinite(priceFloat) || priceFloat < 0)) {
        throw new Error("Prix unitaire HTVA invalide");
      }
      const { data: res, error } = await supabase.rpc("rfq_external_submit_response" as never, {
        _token: token,
        _unit_price_excl_vat_cents: decline ? 0 : Math.round(priceFloat * 100),
        _currency_code: data?.rfq.currency_code || "EUR",
        _quantity_available: quantityAvail ? parseInt(quantityAvail, 10) : null,
        _lead_time_days: leadTime ? parseInt(leadTime, 10) : null,
        _validity_days: validity ? parseInt(validity, 10) : null,
        _payment_terms: paymentTerms || null,
        _comment: comment || null,
        _attachments_urls: [],
        _contact_email: contactEmail || null,
        _contact_name: contactName || null,
        _decline: decline,
      } as never);
      if (error) throw error;
      return { res, decline };
    },
    onSuccess: ({ decline }) => {
      toast.success(decline ? "Réponse déclinée — merci" : "Devis envoyé — merci !");
      qc.invalidateQueries({ queryKey: ["rfq-external-invitation", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-2xl mx-auto py-12">
        <Helmet><title>Invitation non disponible · MediKong</title></Helmet>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Invitation non disponible
            </CardTitle>
            <CardDescription>
              {(error as Error)?.message || "Le lien n'est pas valide ou a expiré."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur MediKong qui vous a envoyé ce lien.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation, rfq, vendor, response } = data;
  const alreadyResponded = invitation.status === "responded";
  const declined = invitation.status === "declined";
  const currency = rfq.currency_code || "EUR";

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-6">
      <Helmet>
        <title>Demande de prix MediKong · {vendor.name}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          {vendor.logo_url && (
            <img src={vendor.logo_url} alt={vendor.name} className="h-12 w-12 object-contain rounded border bg-white" referrerPolicy="no-referrer" />
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Demande de prix MediKong</h1>
            <p className="text-sm text-muted-foreground">
              Destinataire : <span className="font-medium">{vendor.name}</span> · {invitation.contact_email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Lien sécurisé · expire le {fmtDate(invitation.token_expires_at)}
        </div>
      </header>

      {alreadyResponded && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4 flex items-center gap-2 text-emerald-900 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Votre devis a été enregistré le {fmtDate(invitation.responded_at)}. Vous pouvez le mettre à jour ci-dessous tant que le lien est valide.
          </CardContent>
        </Card>
      )}

      {declined && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 flex items-center gap-2 text-amber-900 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Vous avez décliné cette demande. Si c'est une erreur, soumettez un devis ci-dessous pour revenir sur votre choix.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Demande</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-muted-foreground">Produit</div><div className="font-medium">{rfq.product_name || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Marque</div><div className="font-medium">{rfq.brand_name || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Quantité</div><div className="font-medium">{rfq.quantity} u.</div></div>
            <div><div className="text-xs text-muted-foreground">Pays livraison</div><div className="font-medium">{rfq.destination_country_code}</div></div>
            <div><div className="text-xs text-muted-foreground">Prix cible HTVA</div><div className="font-medium">{fmtCents(rfq.target_price_excl_vat_cents, currency)}</div></div>
            <div><div className="text-xs text-muted-foreground">Devise</div><div className="font-medium">{currency}</div></div>
            <div><div className="text-xs text-muted-foreground">Date de livraison souhaitée</div><div className="font-medium">{fmtDate(rfq.desired_delivery_date)}</div></div>
            <div><div className="text-xs text-muted-foreground">Échéance de réponse</div><div className="font-medium">{fmtDate(rfq.responses_deadline)}</div></div>
            <div><div className="text-xs text-muted-foreground">Conditions de paiement</div><div className="font-medium">{rfq.payment_terms || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Validité offre demandée</div><div className="font-medium">{rfq.required_offer_validity_days ? `${rfq.required_offer_validity_days} j` : "—"}</div></div>
          </div>
          {rfq.comment && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-1">Commentaire acheteur</div>
              <p className="text-sm whitespace-pre-wrap">{rfq.comment}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Votre devis</CardTitle>
          <CardDescription>Tous les prix HTVA. Vous pouvez modifier votre réponse tant que le lien est valide.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prix unitaire HTVA ({currency}) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Quantité disponible</Label>
              <Input
                type="number"
                min="0"
                value={quantityAvail}
                onChange={(e) => setQuantityAvail(e.target.value)}
                placeholder={String(rfq.quantity)}
              />
            </div>
            <div className="space-y-1">
              <Label>Délai de livraison (jours)</Label>
              <Input
                type="number"
                min="0"
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                placeholder="ex. 5"
              />
            </div>
            <div className="space-y-1">
              <Label>Validité offre (jours)</Label>
              <Input
                type="number"
                min="0"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
                placeholder="ex. 30"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Conditions de paiement</Label>
              <Input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="ex. 30 jours fin de mois"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Commentaire / précisions</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conditions particulières, alternatives proposées, etc."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label>Email de contact</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Nom du contact</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-3">
            <Button
              variant="ghost"
              onClick={() => submitMut.mutate(true)}
              disabled={submitMut.isPending}
            >
              Décliner cette demande
            </Button>
            <Button
              onClick={() => submitMut.mutate(false)}
              disabled={submitMut.isPending || !unitPrice.trim()}
              size="lg"
            >
              {submitMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {alreadyResponded ? "Mettre à jour le devis" : "Envoyer le devis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        MediKong SRL · BE 1005.771.323 · 23 rue de la Procession, 7822 Ath
      </p>
    </div>
  );
}
