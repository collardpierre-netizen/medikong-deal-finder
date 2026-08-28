import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { fmtEur } from "@/lib/format-currency";
import medikongLogo from "@/assets/medikong-logo-cropped.png";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EpcPaymentQr from "@/components/payments/EpcPaymentQr";

type OrderData = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_due_date?: string | null;
  notes?: string | null;
  is_forecast?: boolean;
  customer?: any;
  lines: Array<{
    id: string;
    quantity: number;
    unit_price_excl_vat: number;
    vat_rate: number;
    line_total_excl_vat: number;
    manual_label?: string | null;
    product_name?: string | null;
    vendor_name?: string | null;
  }>;
  vendor_bank?: any;
  public_access_expires_at?: string | null;
  customer_validated_at?: string | null;
  customer_validation_email?: string | null;
  tracking_url?: string | null;
  tracking_carrier?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En traitement",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

const PublicOrderPage = () => {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPin, setRequiresPin] = useState(false);
  const [invalidPin, setInvalidPin] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationEmail, setValidationEmail] = useState("");
  const [validatingOrder, setValidatingOrder] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchOrder = async (pinValue?: string) => {
    if (!token) {
      setError("Lien invalide");
      setLoading(false);
      return;
    }
    const { data, error: rpcErr } = await supabase.rpc("public_get_order_by_token" as any, {
      _token: token,
      _pin: pinValue || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else if (!data) {
      setError("Commande introuvable.");
    } else {
      const d = data as any;
      if (d.expired) {
        setExpired(true);
      } else if (d.requires_pin) {
        setRequiresPin(true);
        setInvalidPin(!!d.invalid_pin);
      } else {
        setOrder(d as OrderData);
        setRequiresPin(false);
        setInvalidPin(false);
      }
    }
    setLoading(false);
    setSubmitting(false);
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setInvalidPin(false);
    await fetchOrder(pin);
  };

  const validateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const email = validationEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError("Email invalide.");
      return;
    }
    setValidatingOrder(true);
    const { data, error } = await supabase.rpc("public_validate_order" as any, {
      _token: token,
      _pin: pin || null,
      _email: email,
    });
    if (error) {
      setValidationError(error.message || "Validation impossible.");
    } else {
      setOrder((prev) => prev ? {
        ...prev,
        customer_validated_at: (data as any)?.validated_at || new Date().toISOString(),
        customer_validation_email: email,
        status: prev.status === "draft" || prev.status === "pending" ? "confirmed" : prev.status,
      } : prev);
    }
    setValidatingOrder(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-mk-blue" /></div>;

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white border border-slate-200 rounded-lg p-8 text-center">
          <div className="text-2xl font-bold text-slate-900 mb-2">Lien expiré</div>
          <p className="text-sm text-slate-500">Ce lien n'est plus valide. Contactez votre interlocuteur MediKong pour obtenir un nouveau lien.</p>
        </div>
      </div>
    );
  }

  if (requiresPin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
        <form onSubmit={submitPin} className="max-w-sm w-full bg-white border border-slate-200 rounded-lg p-8 space-y-4">
          <div className="flex items-center gap-2 text-mk-blue">
            <Lock size={18} /> <span className="font-semibold">Accès protégé</span>
          </div>
          <p className="text-sm text-slate-500">Saisissez le code d'accès communiqué par votre interlocuteur MediKong.</p>
          <Input
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="Code PIN"
            inputMode="numeric"
            className="text-center tracking-widest text-lg"
          />
          {invalidPin && <div className="text-xs text-red-600">Code incorrect.</div>}
          <Button type="submit" disabled={submitting || pin.length < 4} className="w-full" style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
            {submitting ? "Vérification…" : "Accéder à la commande"}
          </Button>
        </form>
      </div>
    );
  }

  if (error || !order) return <div className="min-h-screen flex items-center justify-center text-slate-500">{error ?? "Introuvable"}</div>;

  const isQuote = order.status === "draft" || order.is_forecast;
  const docTitle = isQuote ? "DEVIS" : "BON DE COMMANDE";

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <Helmet>
        <title>{docTitle} {order.order_number} — MediKong</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-8 overflow-x-hidden">
        <div className="flex items-start justify-between mb-6">
          <img src={medikongLogo} alt="MediKong" className="h-12 sm:h-14 w-auto" />
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-900">MediKong</div>
            <div>MediKong SRL</div>
            <div>23 rue de la Procession</div>
            <div>7822 Ath, Belgique</div>
            <div>TVA : BE 1005.771.323</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-mk-blue">{docTitle}</div>
            {isQuote && (
              <span className="text-[11px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded">
                Devis — non engageant
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500 mt-1">N° {order.order_number} · {new Date(order.created_at).toLocaleDateString("fr-BE")} · Statut : {STATUS_LABEL[order.status] ?? order.status}{order.is_forecast ? " · Prévisionnel" : ""}</div>
          {order.public_access_expires_at && (
            <div className="text-[11px] text-slate-400 mt-1">Lien valable jusqu'au {new Date(order.public_access_expires_at).toLocaleDateString("fr-BE")}</div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div>
            <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Destinataire</div>
            <div className="font-medium">{order.customer?.company_name ?? "—"}</div>
            {order.customer?.address_line1 && <div className="text-xs text-slate-500">{order.customer.address_line1}</div>}
            {(order.customer?.postal_code || order.customer?.city) && <div className="text-xs text-slate-500">{order.customer?.postal_code} {order.customer?.city}</div>}
            {order.customer?.vat_number && <div className="text-xs text-slate-500">TVA : {order.customer.vat_number}</div>}
            {order.customer?.email && <div className="text-xs text-slate-500">{order.customer.email}</div>}

            {(order as any).fulfillment_mode && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "#E2E8F0" }}>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Mode logistique</div>
                <div className="text-sm font-medium">
                  {(order as any).fulfillment_mode === "pickup" ? "🏬 Picking — retrait sur place" : "📦 Livraison"}
                </div>
                {(order as any).fulfillment_mode === "delivery" && (order as any).shipping_address && (
                  <div className="mt-1 text-xs text-slate-600 leading-snug">
                    {(order as any).shipping_address.label && <div className="font-medium text-slate-800">{(order as any).shipping_address.label}</div>}
                    {(order as any).shipping_address.address_l1 && <div>{(order as any).shipping_address.address_l1}</div>}
                    {(order as any).shipping_address.address_l2 && <div>{(order as any).shipping_address.address_l2}</div>}
                    <div>
                      {(order as any).shipping_address.postal_code} {(order as any).shipping_address.city}
                      {(order as any).shipping_address.country_code ? ` (${(order as any).shipping_address.country_code})` : ""}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Paiement</div>
            <div className="font-medium">{order.payment_method ?? "—"}</div>
            <div className="text-xs text-slate-500">Statut : {order.payment_status ?? "—"}</div>
            {order.payment_due_date && <div className="text-xs text-slate-500">Échéance : {new Date(order.payment_due_date).toLocaleDateString("fr-BE")}</div>}
          </div>
        </div>

        {(order.tracking_url || order.tracking_number || order.tracking_carrier || order.status === "delivered") && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[11px] uppercase text-indigo-700 font-semibold">Suivi d'expédition</div>
              {order.status === "delivered" && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Livrée</span>
              )}
            </div>
            {order.delivered_at && (
              <div className="text-xs text-emerald-700 font-medium">Livrée le {new Date(order.delivered_at).toLocaleString("fr-BE")}</div>
            )}
            {order.shipped_at && !order.delivered_at && (
              <div className="text-xs text-slate-600">Expédiée le {new Date(order.shipped_at).toLocaleString("fr-BE")}</div>
            )}
            {order.tracking_carrier && (
              <div className="text-sm text-slate-800 mt-1"><strong>Transporteur :</strong> {order.tracking_carrier}</div>
            )}
            {order.tracking_number && (
              <div className="text-sm text-slate-800"><strong>N° de colis :</strong> <span className="font-mono">{order.tracking_number}</span></div>
            )}
            {order.tracking_url && (
              <a href={order.tracking_url} target="_blank" rel="noreferrer" className="inline-block mt-2 bg-mk-blue text-white text-sm font-semibold px-4 py-2 rounded" style={{ backgroundColor: "#1C58D9" }}>
                Suivre mon colis →
              </a>
            )}
          </div>
        )}



        {order.notes && (
          <div className="bg-blue-50/60 border-l-2 border-blue-400 px-3 py-2 rounded text-sm italic text-slate-700 mb-6">{order.notes}</div>
        )}

        {/* Mobile : cartes empilées (aucun scroll latéral) */}
        <div className="sm:hidden space-y-2 mb-4">
          {(order.lines || []).map((l) => (
            <div key={l.id} className="border border-slate-200 rounded-lg p-3">
              <div className="text-sm font-medium text-slate-900 break-words">{l.manual_label || l.product_name || "—"}</div>
              {l.vendor_name && <div className="text-xs text-slate-500 mt-0.5 break-words">{l.vendor_name}</div>}
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Qté</dt>
                <dd className="text-right text-slate-900">{l.quantity}</dd>
                <dt className="text-slate-500">PU HT</dt>
                <dd className="text-right text-slate-900">{fmtEur(Number(l.unit_price_excl_vat) || 0)} €</dd>
                <dt className="text-slate-500">TVA</dt>
                <dd className="text-right text-slate-900">{Number(l.vat_rate ?? 0).toFixed(0)}%</dd>
                <dt className="text-slate-500">Total HT</dt>
                <dd className="text-right font-semibold text-slate-900">{fmtEur(Number(l.line_total_excl_vat) || 0)} €</dd>
              </dl>
            </div>
          ))}
          {(order.lines || []).length === 0 && (
            <div className="border border-slate-200 rounded-lg px-3 py-6 text-center text-slate-400 text-sm">Aucune ligne</div>
          )}
        </div>

        {/* Desktop : tableau */}
        <table className="hidden sm:table w-full table-fixed text-sm border border-slate-200 rounded overflow-hidden mb-4">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase text-slate-500 w-[34%]">Article</th>
              <th className="text-left px-3 py-2 text-[11px] uppercase text-slate-500 w-[22%]">Fournisseur</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500 w-[8%]">Qté</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500 w-[12%]">PU HT</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500 w-[8%]">TVA</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500 w-[16%]">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines || []).map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2 break-words">{l.manual_label || l.product_name || "—"}</td>
                <td className="px-3 py-2 text-slate-600 break-words">{l.vendor_name ?? "—"}</td>
                <td className="px-3 py-2 text-right">{l.quantity}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{fmtEur(Number(l.unit_price_excl_vat) || 0)} €</td>
                <td className="px-3 py-2 text-right">{Number(l.vat_rate ?? 0).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{fmtEur(Number(l.line_total_excl_vat) || 0)} €</td>
              </tr>
            ))}
            {(order.lines || []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucune ligne</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex flex-col sm:items-end gap-1 text-sm mb-6">
          <div className="flex justify-between sm:justify-end gap-4 sm:gap-8"><span className="text-slate-500">Total HT</span><span className="font-medium">{fmtEur(Number(order.subtotal_excl_vat) || 0)} €</span></div>
          <div className="flex justify-between sm:justify-end gap-4 sm:gap-8"><span className="text-slate-500">TVA</span><span className="font-medium">{fmtEur(Number(order.vat_amount) || 0)} €</span></div>
          <div className="flex justify-between sm:justify-end gap-4 sm:gap-8 bg-mk-blue text-white px-4 py-2 rounded mt-1"><span>Total TTC</span><span className="font-bold">{fmtEur(Number(order.total_incl_vat) || 0)} €</span></div>
        </div>


        {order.vendor_bank && (
          <div className="bg-slate-50 border border-slate-200 rounded p-4 text-sm">
            <div className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Informations de paiement — {order.vendor_bank.company_name || order.vendor_bank.name}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {order.vendor_bank.bank_name && <div><div className="text-xs text-slate-500">Banque</div><div className="font-medium">{order.vendor_bank.bank_name}</div></div>}
              {order.vendor_bank.iban && <div className="col-span-2"><div className="text-xs text-slate-500">IBAN</div><div className="font-medium tracking-wide">{order.vendor_bank.iban}</div></div>}
              {order.vendor_bank.bic && <div><div className="text-xs text-slate-500">BIC</div><div className="font-medium">{order.vendor_bank.bic}</div></div>}
              {order.vendor_bank.vat_number && <div className="col-span-2"><div className="text-xs text-slate-500">TVA fournisseur</div><div className="font-medium">{order.vendor_bank.vat_number}</div></div>}
            </div>
            <div className="mt-3 text-xs text-slate-500">Communication : <span className="font-mono">{order.order_number}</span></div>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
          {order.customer_validated_at ? (
            <div className="flex items-start gap-2 text-sm text-emerald-700">
              <CheckCircle2 size={18} className="mt-0.5" />
              <div>
                <div className="font-semibold">Commande validée</div>
                <div className="text-xs text-slate-600">
                  {new Date(order.customer_validated_at).toLocaleString("fr-BE")}
                  {order.customer_validation_email ? ` · ${order.customer_validation_email}` : ""}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={validateOrder} className="space-y-3">
              <div>
                <div className="font-semibold text-slate-900">Valider la commande</div>
                <div className="text-xs text-slate-500">Encodez votre email pour confirmer la validation.</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  value={validationEmail}
                  onChange={(e) => setValidationEmail(e.target.value)}
                  placeholder="email@entreprise.be"
                  className="bg-white"
                />
                <Button type="submit" disabled={validatingOrder} style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
                  {validatingOrder ? "Validation…" : "Valider la commande"}
                </Button>
              </div>
              {validationError && <div className="text-xs text-red-600">{validationError}</div>}
            </form>
          )}
        </div>

        <div className="text-center text-xs text-slate-400 mt-8">Bon de commande émis via MediKong</div>
      </div>
    </div>
  );
};

export default PublicOrderPage;
