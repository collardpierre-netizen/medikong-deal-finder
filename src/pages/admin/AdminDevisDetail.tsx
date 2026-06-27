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

  const convertToOrder = (force = false) => runRpc("Conversion", async () => {
    if (force) {
      const ok = window.confirm(
        `Forcer la conversion de ce devis (statut "${STATUS_LABEL[quote.status] ?? quote.status}") en commande ?\n\nLa commande sera créée même si le devis n'est pas marqué comme payé.`
      );
      if (!ok) return;
    }
    const { data, error } = await supabase.rpc("convert_quote_to_order" as any, { _quote_id: id, _force: force });
    if (error) throw error;
    if ((data as any)?.error) {
      toast.error(`Conversion impossible : ${(data as any).error}`);
      return;
    }
    toast.success(force ? "Devis converti manuellement en commande" : "Devis converti en commande");
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
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500 w-20">Qté</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500 w-32">PU HT</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500 w-20">TVA</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500 w-24" title="Commission MediKong (% marge). Vide = contrat vendeur.">Com %</th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase font-semibold text-slate-500 w-28">Total HT</th>
                  {quote.status === "draft" && <th className="w-20"></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => (
                  <QuoteLineRow
                    key={l.id}
                    line={l}
                    editable={quote.status === "draft"}
                    canDelete={lines.length > 1}
                    onChanged={refetch}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50/40">
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-500">Total HT</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(quote.total_ht_cents) / 100)} €</td>
                  {quote.status === "draft" && <td />}
                </tr>
                <tr className="bg-slate-50/40">
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-500">TVA</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(quote.total_tva_cents) / 100)} €</td>
                  {quote.status === "draft" && <td />}
                </tr>
                <tr className="border-t" style={{ backgroundColor: "#1C58D9" }}>
                  <td colSpan={5} className="px-3 py-3 text-right text-white font-semibold">Total TTC</td>
                  <td className="px-3 py-3 text-right text-white font-bold text-base">{fmtEur(Number(quote.total_ttc_cents) / 100)} €</td>
                  {quote.status === "draft" && <td style={{ backgroundColor: "#1C58D9" }} />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right : actions + tracking */}
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4 space-y-2" style={{ borderColor: "#E2E8F0" }}>
            <div className="text-sm font-semibold mb-2">Actions</div>
            {quote.status === "draft" && (
              <Button asChild className="w-full justify-start" style={{ backgroundColor: "#1C58D9", color: "#fff" }}>
                <Link to={`/admin/devis/${id}/editer`}>
                  <Pencil size={14} className="mr-2" /> Éditer (client, vendeur, lignes…)
                </Link>
              </Button>
            )}
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

function QuoteLineRow({ line, editable, canDelete, onChanged }: { line: any; editable: boolean; canDelete: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState<number>(Number(line.qty || 1));
  const [pu, setPu] = useState<string>((Number(line.unit_price_ht_cents || 0) / 100).toString());
  const [vat, setVat] = useState<number>(Number(line.vat_rate || 21));
  const [label, setLabel] = useState<string>(line.label || "");
  const [com, setCom] = useState<string>(line.commission_rate != null ? String(line.commission_rate) : "");

  const reset = () => {
    setQty(Number(line.qty || 1));
    setPu((Number(line.unit_price_ht_cents || 0) / 100).toString());
    setVat(Number(line.vat_rate || 21));
    setLabel(line.label || "");
    setCom(line.commission_rate != null ? String(line.commission_rate) : "");
    setEditing(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const trimmedCom = com.trim();
      const comRate = trimmedCom === "" ? null : Number(trimmedCom);
      const { error } = await supabase.rpc("admin_update_quote_line" as any, {
        _line_id: line.id,
        _qty: Math.max(1, Number(qty) || 1),
        _unit_price_ht_cents: Math.round((Number(pu) || 0) * 100),
        _vat_rate: Number(vat) || 0,
        _label: label,
        _commission_rate: comRate,
        _commission_amount_cents: null,
        _commission_basis: comRate != null ? "margin" : null,
      });
      if (error) throw error;
      toast.success("Ligne mise à jour");
      setEditing(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Échec");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Supprimer cette ligne ?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_delete_quote_line" as any, { _line_id: line.id });
      if (error) throw error;
      toast.success("Ligne supprimée");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Échec");
    } finally {
      setBusy(false);
    }
  };

  const comDisplay = line.commission_rate != null
    ? `${Number(line.commission_rate).toFixed(line.commission_rate % 1 === 0 ? 0 : 1)}%`
    : <span className="text-slate-400 italic">auto</span>;

  if (!editable) {
    return (
      <tr className="border-t">
        <td className="px-3 py-2">{line.label}</td>
        <td className="px-3 py-2 text-right">{line.qty}</td>
        <td className="px-3 py-2 text-right">{fmtEur(Number(line.unit_price_ht_cents) / 100)} €</td>
        <td className="px-3 py-2 text-right">{Number(line.vat_rate).toFixed(0)}%</td>
        <td className="px-3 py-2 text-right">{comDisplay}</td>
        <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(line.total_ht_cents) / 100)} €</td>
      </tr>
    );
  }

  if (!editing) {
    return (
      <tr className="border-t group">
        <td className="px-3 py-2">{line.label}</td>
        <td className="px-3 py-2 text-right">{line.qty}</td>
        <td className="px-3 py-2 text-right">{fmtEur(Number(line.unit_price_ht_cents) / 100)} €</td>
        <td className="px-3 py-2 text-right">{Number(line.vat_rate).toFixed(0)}%</td>
        <td className="px-3 py-2 text-right">{comDisplay}</td>
        <td className="px-3 py-2 text-right font-medium">{fmtEur(Number(line.total_ht_cents) / 100)} €</td>
        <td className="px-2 py-1">
          <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)} title="Éditer cette ligne">
              <Pencil size={12} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={remove} disabled={busy || !canDelete} title={canDelete ? "Supprimer" : "Au moins 1 ligne requise"}>
              <Trash2 size={12} />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-blue-50/40">
      <td className="px-2 py-1">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
      </td>
      <td className="px-2 py-1">
        <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="h-8 text-sm text-right" />
      </td>
      <td className="px-2 py-1">
        <Input type="number" step="0.01" min={0} value={pu} onChange={(e) => setPu(e.target.value)} className="h-8 text-sm text-right" />
      </td>
      <td className="px-2 py-1">
        <Input type="number" min={0} max={100} step="0.5" value={vat} onChange={(e) => setVat(Number(e.target.value) || 0)} className="h-8 text-sm text-right" />
      </td>
      <td className="px-2 py-1">
        <Input type="number" min={0} max={100} step="0.5" placeholder="auto" value={com} onChange={(e) => setCom(e.target.value)} className="h-8 text-sm text-right" title="Vide = contrat vendeur" />
      </td>
      <td className="px-2 py-2 text-right text-xs text-slate-500">
        {fmtEur((Number(qty) * Math.round((Number(pu) || 0) * 100)) / 100)} €
      </td>
      <td className="px-2 py-1">
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-700" onClick={save} disabled={busy} title="Enregistrer">
            <Check size={14} />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset} disabled={busy} title="Annuler">
            <X size={14} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default AdminDevisDetail;
