import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtEur } from "@/lib/format-currency";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, FileDown, RefreshCw, ArrowRightCircle, Copy, Eye, CheckCircle2, XCircle, Clock, Pencil, Trash2, Check, X } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", declined: "Refusé", paid: "Payé", converted: "Converti",
};

const AdminDevisDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [recipientOverride, setRecipientOverride] = useState("");

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ["admin-quote", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customer:customers(*), vendor:vendors(*), lines:quote_lines(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6 text-slate-500">Chargement…</div>;
  if (!quote) return <div className="p-6 text-slate-500">Devis introuvable. <Link to="/admin/devis" className="text-sky-600">Retour</Link></div>;

  const lines = (quote.lines || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const publicUrl = quote.public_token ? `${window.location.origin}/devis/${quote.public_token}` : null;

  const runRpc = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      await fn();
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
    } catch (e: any) {
      toast.error(e?.message || `Échec : ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const regeneratePdf = () => runRpc("PDF", async () => {
    const { data, error } = await supabase.functions.invoke("generate-quote-pdf", { body: { quote_id: id } });
    if (error) throw error;
    toast.success("PDF généré");
    if ((data as any)?.pdf_url) window.open((data as any).pdf_url, "_blank");
  });

  const sendEmail = () => runRpc("Email", async () => {
    const { error } = await supabase.functions.invoke("send-quote-email", {
      body: {
        quote_id: id,
        recipient_email: recipientOverride || undefined,
        public_origin: window.location.origin,
      },
    });
    if (error) throw error;
    toast.success("Email envoyé à l'acheteur");
  });

  const convertToOrder = () => runRpc("Conversion", async () => {
    const { data, error } = await supabase.rpc("convert_quote_to_order" as any, { _quote_id: id });
    if (error) throw error;
    toast.success("Devis converti en commande");
    const orderId = (data as any)?.order_id;
    if (orderId) navigate(`/admin/commandes`);
  });

  const duplicate = () => runRpc("Duplication", async () => {
    const { data, error } = await supabase.rpc("admin_duplicate_quote" as any, { _quote_id: id });
    if (error) throw error;
    toast.success("Devis dupliqué");
    if (data) navigate(`/admin/devis/${data}`);
  });

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast.success("Lien copié");
  };

  return (
    <div>
      <AdminTopBar title={`Devis ${quote.quote_number}`} subtitle={`Statut : ${STATUS_LABEL[quote.status] ?? quote.status}`} />

      <div className="mb-4">
        <Link to="/admin/devis" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} /> Retour aux devis
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left : header + lignes + totaux */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-lg p-4" style={{ borderColor: "#E2E8F0" }}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Vendeur</div>
                <div className="font-medium">{quote.vendor?.company_name || quote.vendor?.name || "—"}</div>
                {quote.vendor?.vat_number && <div className="text-xs text-slate-500">TVA : {quote.vendor.vat_number}</div>}
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-400 font-semibold mb-1">Acheteur</div>
                <div className="font-medium">{quote.customer?.company_name || "—"}</div>
                <div className="text-xs text-slate-500">{quote.customer?.email}</div>
                {quote.customer?.vat_number && <div className="text-xs text-slate-500">TVA : {quote.customer.vat_number}</div>}
              </div>
            </div>
            {quote.notes_customer && (
              <div className="bg-blue-50/60 border-l-2 border-blue-400 px-3 py-2 rounded text-sm italic text-slate-700">{quote.notes_customer}</div>
            )}
          </div>

          <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#F8FAFC" }}>
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Article</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Qté</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">PU HT</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">TVA</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2">{l.label}</td>
                    <td className="px-3 py-2 text-right">{l.qty}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(Number(l.unit_price_ht_cents) / 100)} €</td>
                    <td className="px-3 py-2 text-right">{Number(l.vat_rate).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(l.total_ht_cents) / 100)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50/40">
                  <td colSpan={4} className="px-3 py-2 text-right text-slate-500">Total HT</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(quote.total_ht_cents) / 100)} €</td>
                </tr>
                <tr className="bg-slate-50/40">
                  <td colSpan={4} className="px-3 py-2 text-right text-slate-500">TVA</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(quote.total_tva_cents) / 100)} €</td>
                </tr>
                <tr className="border-t" style={{ backgroundColor: "#1C58D9" }}>
                  <td colSpan={4} className="px-3 py-3 text-right text-white font-semibold">Total TTC</td>
                  <td className="px-3 py-3 text-right text-white font-bold text-base">{fmtEur(Number(quote.total_ttc_cents) / 100)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right : actions + tracking */}
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-sm font-semibold mb-2">Actions</div>
            <Button onClick={regeneratePdf} disabled={busy !== null} className="w-full justify-start" variant="outline">
              <FileDown size={14} className="mr-2" /> {busy === "PDF" ? "Génération…" : "Générer / Re-générer le PDF"}
            </Button>
            <div>
              <input
                type="email"
                placeholder={quote.customer?.email || "email destinataire"}
                value={recipientOverride}
                onChange={(e) => setRecipientOverride(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border rounded mb-1"
              />
              <Button onClick={sendEmail} disabled={busy !== null || (!quote.customer?.email && !recipientOverride)} className="w-full justify-start" style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
                <Send size={14} className="mr-2" /> {busy === "Email" ? "Envoi…" : "Envoyer par email"}
              </Button>
            </div>
            <Button onClick={copyLink} disabled={!publicUrl} className="w-full justify-start" variant="outline">
              <Copy size={14} className="mr-2" /> Copier le lien public
            </Button>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-sky-600 hover:underline break-all">{publicUrl}</a>
            )}
            <Button onClick={duplicate} disabled={busy !== null} className="w-full justify-start" variant="outline">
              <Copy size={14} className="mr-2" /> {busy === "Duplication" ? "Duplication…" : "Dupliquer ce devis"}
            </Button>
            {quote.status === "accepted" && (
              <Button onClick={convertToOrder} disabled={busy !== null} className="w-full justify-start bg-green-600 text-white hover:bg-green-700">
                <ArrowRightCircle size={14} className="mr-2" /> {busy === "Conversion" ? "Conversion…" : "Convertir en commande"}
              </Button>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-sm font-semibold mb-2">Historique</div>
            <TimelineRow icon={<Clock size={12} />} label="Créé" date={quote.created_at} />
            <TimelineRow icon={<Send size={12} />} label="Envoyé" date={quote.sent_at} />
            <TimelineRow icon={<Eye size={12} />} label="Vu par l'acheteur" date={quote.viewed_at} />
            <TimelineRow icon={<CheckCircle2 size={12} className="text-green-600" />} label="Accepté" date={quote.accepted_at} />
            <TimelineRow icon={<XCircle size={12} className="text-red-600" />} label="Refusé" date={quote.declined_at} />
            <TimelineRow icon={<ArrowRightCircle size={12} className="text-violet-600" />} label="Converti en commande" date={quote.converted_at} />
            {quote.token_expires_at && (
              <div className="text-xs text-slate-500 pt-2 border-t mt-2">
                Lien expire le {new Date(quote.token_expires_at).toLocaleDateString("fr-BE")} à {new Date(quote.token_expires_at).toLocaleTimeString("fr-BE")}
              </div>
            )}
          </div>

          {quote.notes_internal && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <div className="font-semibold mb-1">Note interne (non visible acheteur)</div>
              {quote.notes_internal}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TimelineRow = ({ icon, label, date }: { icon: React.ReactNode; label: string; date: string | null }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-slate-100">{icon}</span>
    <span className="flex-1 text-slate-600">{label}</span>
    <span className="text-slate-400">{date ? new Date(date).toLocaleString("fr-BE") : "—"}</span>
  </div>
);

export default AdminDevisDetail;
