import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { fmtEur } from "@/lib/format-currency";
import medikongLogo from "@/assets/medikong-logo.png";
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }
      const { data, error: rpcErr } = await supabase.rpc("public_get_order_by_token" as any, { _token: token });
      if (rpcErr) setError(rpcErr.message);
      else if (!data) setError("Commande introuvable.");
      else setOrder(data as any);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-mk-blue" /></div>;
  if (error || !order) return <div className="min-h-screen flex items-center justify-center text-slate-500">{error ?? "Introuvable"}</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <Helmet>
        <title>Commande {order.order_number} — MediKong</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex items-start justify-between mb-6">
          <img src={medikongLogo} alt="MediKong" className="h-10" />
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-900">MediKong</div>
            <div>Balooh SRL</div>
            <div>23 rue de la Procession</div>
            <div>7822 Ath, Belgique</div>
            <div>TVA : BE 1005.771.323</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-2xl font-bold text-mk-blue">BON DE COMMANDE</div>
          <div className="text-sm text-slate-500 mt-1">N° {order.order_number} · {new Date(order.created_at).toLocaleDateString("fr-BE")} · Statut : {STATUS_LABEL[order.status] ?? order.status}{order.is_forecast ? " · Prévisionnel" : ""}</div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Destinataire</div>
            <div className="font-medium">{order.customer?.company_name ?? "—"}</div>
            {order.customer?.address_line1 && <div className="text-xs text-slate-500">{order.customer.address_line1}</div>}
            {(order.customer?.postal_code || order.customer?.city) && <div className="text-xs text-slate-500">{order.customer?.postal_code} {order.customer?.city}</div>}
            {order.customer?.vat_number && <div className="text-xs text-slate-500">TVA : {order.customer.vat_number}</div>}
            {order.customer?.email && <div className="text-xs text-slate-500">{order.customer.email}</div>}
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Paiement</div>
            <div className="font-medium">{order.payment_method ?? "—"}</div>
            <div className="text-xs text-slate-500">Statut : {order.payment_status ?? "—"}</div>
            {order.payment_due_date && <div className="text-xs text-slate-500">Échéance : {new Date(order.payment_due_date).toLocaleDateString("fr-BE")}</div>}
          </div>
        </div>

        {order.notes && (
          <div className="bg-blue-50/60 border-l-2 border-blue-400 px-3 py-2 rounded text-sm italic text-slate-700 mb-6">{order.notes}</div>
        )}

        <table className="w-full text-sm border border-slate-200 rounded overflow-hidden mb-4">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase text-slate-500">Article</th>
              <th className="text-left px-3 py-2 text-[11px] uppercase text-slate-500">Fournisseur</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500">Qté</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500">PU HT</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500">TVA</th>
              <th className="text-right px-3 py-2 text-[11px] uppercase text-slate-500">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines || []).map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{l.manual_label || l.product_name || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{l.vendor_name ?? "—"}</td>
                <td className="px-3 py-2 text-right">{l.quantity}</td>
                <td className="px-3 py-2 text-right">{fmtEur(Number(l.unit_price_excl_vat) || 0)} €</td>
                <td className="px-3 py-2 text-right">{Number(l.vat_rate ?? 0).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(l.line_total_excl_vat) || 0)} €</td>
              </tr>
            ))}
            {(order.lines || []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucune ligne</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-1 text-sm mb-6">
          <div className="flex gap-8"><span className="text-slate-500">Total HT</span><span className="font-medium">{fmtEur(Number(order.subtotal_excl_vat) || 0)} €</span></div>
          <div className="flex gap-8"><span className="text-slate-500">TVA</span><span className="font-medium">{fmtEur(Number(order.vat_amount) || 0)} €</span></div>
          <div className="flex gap-8 bg-mk-blue text-white px-4 py-2 rounded mt-1"><span>Total TTC</span><span className="font-bold">{fmtEur(Number(order.total_incl_vat) || 0)} €</span></div>
        </div>

        {order.vendor_bank && (
          <div className="bg-slate-50 border border-slate-200 rounded p-4 text-sm">
            <div className="text-[11px] uppercase text-slate-400 font-semibold mb-2">Informations de paiement — {order.vendor_bank.company_name || order.vendor_bank.name}</div>
            <div className="grid grid-cols-3 gap-3">
              {order.vendor_bank.bank_name && <div><div className="text-xs text-slate-500">Banque</div><div className="font-medium">{order.vendor_bank.bank_name}</div></div>}
              {order.vendor_bank.iban && <div className="col-span-2"><div className="text-xs text-slate-500">IBAN</div><div className="font-medium tracking-wide">{order.vendor_bank.iban}</div></div>}
              {order.vendor_bank.bic && <div><div className="text-xs text-slate-500">BIC</div><div className="font-medium">{order.vendor_bank.bic}</div></div>}
              {order.vendor_bank.vat_number && <div className="col-span-2"><div className="text-xs text-slate-500">TVA fournisseur</div><div className="font-medium">{order.vendor_bank.vat_number}</div></div>}
            </div>
            <div className="mt-3 text-xs text-slate-500">Communication : <span className="font-mono">{order.order_number}</span></div>
          </div>
        )}

        <div className="text-center text-xs text-slate-400 mt-8">Bon de commande émis via MediKong</div>
      </div>
    </div>
  );
};

export default PublicOrderPage;
