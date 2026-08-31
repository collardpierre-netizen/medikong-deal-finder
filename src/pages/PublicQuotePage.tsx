import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtEur } from "@/lib/format-currency";
import { CheckCircle2, XCircle, FileDown, Loader2 } from "lucide-react";
import medikongLogo from "@/assets/medikong-logo-cropped.png";

type QuoteData = {
  id: string;
  quote_number: string;
  status: string;
  payment_method?: string;
  sent_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  paid_at?: string | null;
  total_ht_cents: number;
  total_tva_cents: number;
  total_ttc_cents: number;
  currency_code: string;
  token_expires_at?: string | null;
  notes_customer?: string | null;
  customer?: { company_name?: string; email?: string; address_line1?: string; city?: string; postal_code?: string; vat_number?: string } | null;
  vendor?: { name?: string; company_name?: string; logo_url?: string } | null;
  lines: Array<{ id: string; label: string; qty: number; unit_price_ht_cents: number; vat_rate: number; total_ht_cents: number; total_ttc_cents: number }>;
};

const PublicQuotePage = () => {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_quote_by_token" as any, { _token: token });
        if (rpcErr) throw rpcErr;
        const d = data as any;
        if (d?.error === "not_found") setError("Devis introuvable.");
        else if (d?.error === "expired") setError("Ce devis a expiré.");
        else setQuote(d as QuoteData);
      } catch (e: any) {
        setError(e?.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAction = async (action: "accept" | "decline") => {
    if (!token) return;
    setBusy(action);
    try {
      const { data, error: rpcErr } = await supabase.rpc("quote_public_action" as any, {
        _token: token,
        _action: action,
        _ip: null,
      });
      if (rpcErr) throw rpcErr;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast.success(action === "accept" ? "Devis accepté ✓" : "Devis refusé");
      // refresh
      const { data: fresh } = await supabase.rpc("get_quote_by_token" as any, { _token: token });
      setQuote(fresh as QuoteData);
    } catch (e: any) {
      toast.error(e?.message || "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  const totalLabel = useMemo(() => quote ? fmtEur(Number(quote.total_ttc_cents) / 100) : "0,00", [quote]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
        <div className="bg-white border rounded-lg p-8 max-w-md text-center" style={{ borderColor: "#E2E8F0" }}>
          <XCircle className="mx-auto text-red-500 mb-3" size={36} />
          <h1 className="text-lg font-semibold mb-2">{error}</h1>
          <p className="text-sm text-slate-500">Le lien que vous avez utilisé n'est plus valide. Contactez votre interlocuteur pour obtenir un nouveau devis.</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const isFinal = ["accepted", "declined", "paid", "converted"].includes(quote.status);
  const vendorName = quote.vendor?.company_name || quote.vendor?.name || "Votre fournisseur";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Helmet>
        <title>{`Devis ${quote.quote_number} · ${vendorName}`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          {/* MediKong brand header */}
          <div className="px-6 py-5 border-b flex items-start justify-between gap-4" style={{ borderColor: "#E2E8F0" }}>
            <img src={medikongLogo} alt="MediKong" className="h-12 sm:h-14 w-auto" />
            <div className="text-right text-xs text-slate-500">
              <div className="font-semibold text-slate-900">MediKong</div>
              <div>MediKong SRL</div>
              <div>23 rue de la Procession</div>
              <div>7822 Meslin-l'Évêque, Belgique</div>
              <div>TVA : BE 1005.771.323</div>
            </div>
          </div>

          {/* Quote meta */}
          <div className="px-6 py-5 border-b flex items-start justify-between gap-4" style={{ borderColor: "#E2E8F0" }}>
            <div>
              <div className="text-2xl font-bold" style={{ color: "#1C58D9", letterSpacing: "-0.02em" }}>DEVIS</div>
              <div className="text-sm text-slate-500 mt-1">N° {quote.quote_number} · {quote.sent_at ? new Date(quote.sent_at).toLocaleDateString("fr-BE") : "—"}</div>
              {quote.token_expires_at && (
                <div className="text-xs text-slate-400 mt-1">Valable jusqu'au {new Date(quote.token_expires_at).toLocaleDateString("fr-BE")}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 mb-0.5">Émis par</div>
              <div className="font-semibold">{vendorName}</div>
            </div>
          </div>

          {/* Status banner */}
          {isFinal && (
            <div className={`px-6 py-3 text-sm font-medium ${quote.status === "accepted" || quote.status === "converted" ? "bg-green-50 text-green-800" : quote.status === "declined" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
              {quote.status === "accepted" && "✓ Vous avez accepté ce devis. Votre fournisseur va le convertir en commande."}
              {quote.status === "converted" && "✓ Ce devis a été converti en commande."}
              {quote.status === "declined" && "✗ Vous avez refusé ce devis."}
              {quote.status === "paid" && "✓ Ce devis a été payé."}
            </div>
          )}

          {/* Customer */}
          {quote.customer && (
            <div className="px-6 py-4 border-b" style={{ borderColor: "#F1F5F9" }}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Destinataire</div>
              <div className="font-medium">{quote.customer.company_name}</div>
              <div className="text-xs text-slate-500">{quote.customer.address_line1} {quote.customer.postal_code} {quote.customer.city}</div>
              {quote.customer.vat_number && <div className="text-xs text-slate-500">TVA : {quote.customer.vat_number}</div>}
            </div>
          )}

          {/* Customer note */}
          {quote.notes_customer && (
            <div className="px-6 py-3 bg-blue-50/60 border-b border-blue-100 text-sm italic text-slate-700">{quote.notes_customer}</div>
          )}

          {/* Lines */}
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#E2E8F0" }}>
                  <th className="text-left py-2 text-[11px] uppercase font-semibold text-slate-500">Article</th>
                  <th className="text-right py-2 text-[11px] uppercase font-semibold text-slate-500">Qté</th>
                  <th className="text-right py-2 text-[11px] uppercase font-semibold text-slate-500">PU HT</th>
                  <th className="text-right py-2 text-[11px] uppercase font-semibold text-slate-500">TVA</th>
                  <th className="text-right py-2 text-[11px] uppercase font-semibold text-slate-500">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((l) => (
                  <tr key={l.id} className="border-b" style={{ borderColor: "#F1F5F9" }}>
                    <td className="py-2">{l.label}</td>
                    <td className="py-2 text-right">{l.qty}</td>
                    <td className="py-2 text-right">{fmtEur(Number(l.unit_price_ht_cents) / 100)} €</td>
                    <td className="py-2 text-right text-slate-500">{Number(l.vat_rate).toFixed(0)}%</td>
                    <td className="py-2 text-right font-medium">{fmtEur(Number(l.total_ht_cents) / 100)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 bg-slate-50/50 border-t" style={{ borderColor: "#E2E8F0" }}>
            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total HT</span><span>{fmtEur(Number(quote.total_ht_cents) / 100)} €</span></div>
              <div className="flex justify-between"><span className="text-slate-500">TVA</span><span>{fmtEur(Number(quote.total_tva_cents) / 100)} €</span></div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: "#CBD5E1" }}>
                <span className="font-semibold">Total TTC</span>
                <span className="font-bold text-lg" style={{ color: "#1C58D9" }}>{totalLabel} €</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          {!isFinal && (
            <div className="px-6 py-5 bg-white border-t flex flex-col sm:flex-row gap-3 justify-end" style={{ borderColor: "#E2E8F0" }}>
              <Button
                onClick={() => handleAction("decline")}
                disabled={busy !== null}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle size={16} className="mr-2" /> {busy === "decline" ? "Envoi…" : "Refuser"}
              </Button>
              <Button
                onClick={() => handleAction("accept")}
                disabled={busy !== null}
                className="text-white"
                style={{ backgroundColor: "#1C58D9" }}
              >
                <CheckCircle2 size={16} className="mr-2" /> {busy === "accept" ? "Envoi…" : "Accepter ce devis"}
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Devis sécurisé émis via MediKong · Lien personnel et confidentiel</p>
      </div>
    </div>
  );
};

export default PublicQuotePage;
