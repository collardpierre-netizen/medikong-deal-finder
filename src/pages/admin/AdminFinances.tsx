import { useEffect, useMemo, useState } from "react";
import { Send, FileText, Loader2, RefreshCw, Undo2, History } from "lucide-react";
import PeppolCreditNotesDialog from "@/components/admin/PeppolCreditNotesDialog";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import PeppolStatusBadge from "@/components/admin/PeppolStatusBadge";
import { useI18n } from "@/contexts/I18nContext";
import { useInvoices, useVendors } from "@/hooks/useAdminData";
import {
  DollarSign, TrendingUp, Receipt, CreditCard, RotateCcw,
  AlertTriangle, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AdminFinances = () => {
  const { t } = useI18n();
  const { data: invoicesData = [], isLoading } = useInvoices();
  const { data: vendors = [] } = useVendors();
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "payouts">("overview");
  const [creditingId, setCreditingId] = useState<string | null>(null);
  const [historyInvoice, setHistoryInvoice] = useState<{ id: string; number: string | null } | null>(null);
  const queryClient = useQueryClient();

  // Aggregate credit-note counts per invoice for a "history" indicator.
  const { data: creditNoteCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["admin-peppol-credit-notes-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peppol_credit_notes" as any)
        .select("invoice_id")
        .eq("invoice_type", "order");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data as any[]) || []) {
        map[r.invoice_id] = (map[r.invoice_id] || 0) + 1;
      }
      return map;
    },
  });

  // Realtime: refresh invoices list whenever the Falco webhook updates peppol_status.
  useEffect(() => {
    const channel = supabase
      .channel("admin-finances-peppol")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_invoices" },
        () => queryClient.invalidateQueries({ queryKey: ["admin-order-invoices"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const totalHT = invoicesData.reduce((a, inv) => a + Number(inv.amount_ht), 0);
  const totalTVA = invoicesData.reduce((a, inv) => a + Number(inv.tva_amount || 0), 0);
  const pendingInvoices = invoicesData.filter(i => i.status === "pending");
  const paidInvoices = invoicesData.filter(i => i.status === "paid");

  const commissionData = vendors.filter(v => v.is_active).slice(0, 5).map(v => ({
    seller: (v.company_name || v.name || "").length > 15 ? (v.company_name || v.name || "").substring(0, 15) + "…" : (v.company_name || v.name || ""),
    commission: Number(v.commission_rate) || 12,
  }));

  const tabs = [
    { key: "overview" as const, label: "Vue d'ensemble" },
    { key: "invoices" as const, label: "Factures" },
    { key: "payouts" as const, label: "Reversements" },
  ];

  return (
    <div>
      <AdminTopBar title={t("finances")} subtitle="Revenus, commissions et fiscalité" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-5">
        <KpiCard icon={TrendingUp} label="GMV mois" value={`${fmt(totalHT + totalTVA)} EUR`} />
        <KpiCard icon={DollarSign} label="Factures HT" value={`${fmt(totalHT)} EUR`} iconColor="#059669" iconBg="#F0FDF4" />
        <KpiCard icon={Receipt} label="TVA collectée" value={`${fmt(totalTVA)} EUR`} iconColor="#7C3AED" iconBg="#F5F3FF" />
        <KpiCard icon={CreditCard} label="En attente" value={String(pendingInvoices.length)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={RotateCcw} label="Payées" value={String(paidInvoices.length)} iconColor="#059669" iconBg="#F0FDF4" />
      </div>

      <div className="flex items-center gap-1 mb-4 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0", display: "inline-flex", maxWidth: "100%" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-3 md:px-4 py-2 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap"
            style={{ backgroundColor: activeTab === tab.key ? "#1B5BDA" : "transparent", color: activeTab === tab.key ? "#fff" : "#616B7C" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Taux commission par vendeur</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commissionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8B95A5" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="seller" type="category" tick={{ fontSize: 11, fill: "#616B7C" }} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(v: number) => [`${v}%`]} />
                <Bar dataKey="commission" radius={[0, 4, 4, 0]}>
                  {commissionData.map((_, i) => (
                    <Cell key={i} fill={["#1B5BDA", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D2530" }}>Résumé factures</h3>
            <div className="space-y-4 text-[13px]">
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Total factures</span><span className="font-bold" style={{ color: "#1D2530" }}>{invoicesData.length}</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>En attente</span><span className="font-bold" style={{ color: "#F59E0B" }}>{pendingInvoices.length}</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Payées</span><span className="font-bold" style={{ color: "#059669" }}>{paidInvoices.length}</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Total HT</span><span className="font-bold" style={{ color: "#1D2530" }}>{fmt(totalHT)} EUR</span></div>
              <div className="flex justify-between"><span style={{ color: "#616B7C" }}>Total TTC</span><span className="font-bold" style={{ color: "#059669" }}>{fmt(invoicesData.reduce((a, i) => a + Number(i.amount_ttc || 0), 0))} EUR</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "invoices" && (
        <>
        <div className="flex justify-end mb-3">
          <button
            onClick={async () => {
              const tId = toast.loading("Rafraîchissement des statuts Peppol…");
              const { data, error } = await supabase.functions.invoke("poll-peppol-status", { body: { trigger: "manual" } });
              toast.dismiss(tId);
              let errBody: any = null;
              if (error && (error as any).context && typeof (error as any).context.json === "function") {
                try { errBody = await (error as any).context.clone().json(); } catch { /* noop */ }
              }
              const failed = !!error || (data && data.ok === false);
              if (failed) {
                const payload = errBody || data || {};
                toast.error(`Échec rafraîchissement : ${payload.error || error?.message || "erreur inconnue"}`);
              } else {
                const upd = data?.updated ?? 0;
                const checked = data?.checked ?? 0;
                toast.success(`Statuts rafraîchis — ${upd} mise(s) à jour sur ${checked} document(s) vérifié(s).`);
                queryClient.invalidateQueries({ queryKey: ["admin-order-invoices"] });
              }
            }}
            className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-2 rounded-md hover:bg-slate-50"
            style={{ color: "#1B5BDA", border: "1px solid #E2E8F0", backgroundColor: "#fff" }}
            title="Interroger Falco pour mettre à jour les statuts Peppol"
          >
            <RefreshCw size={13} /> Rafraîchir statuts Peppol
          </button>
        </div>
        <div className="rounded-[10px] overflow-x-auto" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>

          {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                  {["N° Facture", "Commande", "Vendeur", "Type", "HT", "TVA", "TTC", "Émise le", "Statut", "Peppol", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoicesData.map((inv: any) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[12px] font-bold font-mono" style={{ color: "#1B5BDA" }}>{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#616B7C" }}>{inv.order_number || "—"}</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "#616B7C" }}>{inv.vendor_label || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                        backgroundColor: inv.type === "commission" ? "#EFF6FF" : "#F5F3FF",
                        color: inv.type === "commission" ? "#1B5BDA" : "#7C3AED",
                      }}>{inv.type === "commission" ? "Commission" : inv.type === "self_billing" ? "Self-billing" : inv.type}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "#1D2530" }}>{fmt(Number(inv.amount_ht))} EUR</td>
                    <td className="px-4 py-3 text-[11px] font-mono" style={{ color: "#8B95A5" }}>{fmt(Number(inv.tva_amount || 0))} EUR</td>
                    <td className="px-4 py-3 text-[12px] font-bold font-mono" style={{ color: "#059669" }}>{fmt(Number(inv.amount_ttc || 0))} EUR</td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "#8B95A5" }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-BE") : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={inv.status === "paid" ? "paid" : inv.status === "overdue" ? "cancelled" : inv.status === "draft" ? "pending" : inv.status === "generated" ? "paid" : "pending"}
                        label={inv.status === "paid" ? "Payée" : inv.status === "overdue" ? "En retard" : inv.status === "draft" ? "Brouillon" : inv.status === "generated" ? "Générée" : "En attente"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <PeppolStatusBadge
                          status={inv.peppol_status as any}
                          error={inv.peppol_error}
                          retryCount={inv.peppol_retry_count}
                        />
                        {(!inv.peppol_status || inv.peppol_status === "non_envoyé" || inv.peppol_status === "not_sent" || inv.peppol_status === "blocked_missing_id" || inv.peppol_status === "blocked_not_registered" || inv.peppol_status === "failed") && (
                          <button
                            onClick={async () => {
                              const t = toast.loading("Envoi Peppol en cours…");
                              const { data, error } = await supabase.functions.invoke("send-invoice-peppol", { body: { invoice_id: inv.id } });
                              toast.dismiss(t);
                              // On 4xx/5xx, supabase-js puts the JSON body inside error.context (a Response).
                              let errBody: any = null;
                              if (error && (error as any).context && typeof (error as any).context.json === "function") {
                                try { errBody = await (error as any).context.clone().json(); } catch { /* noop */ }
                              }
                              const failed = !!error || (data && data.ok === false);
                              if (failed) {
                                const payload = errBody || data || {};
                                const msg = payload.hint || payload.error || error?.message || "erreur inconnue";
                                toast.error(`Échec envoi Peppol : ${msg}`, { duration: 8000 });
                              } else {
                                toast.success("Facture envoyée via Peppol");
                              }
                              queryClient.invalidateQueries({ queryKey: ["admin-order-invoices"] });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-slate-100"
                            style={{ color: "#1B5BDA" }}
                            title="Envoyer via Peppol"
                          >
                            <Send size={11} /> Envoyer
                          </button>
                        )}
                        {(inv.peppol_status === "sent" || inv.peppol_status === "submitted") && (
                          <button
                            disabled={creditingId === inv.id}
                            onClick={async () => {
                              const reason = window.prompt(
                                `⚠️ ÉMISSION D'UN AVOIR PEPPOL\n\nFacture : ${inv.invoice_number}\nMontant TTC : ${fmt(Number(inv.amount_ttc || 0))} EUR\n\nCette action est IRRÉVERSIBLE : une note de crédit sera transmise via Peppol au destinataire de la facture originale et ne pourra pas être annulée.\n\nSaisissez le motif de l'avoir (obligatoire) :`,
                                "Annulation — commande test",
                              );
                              if (!reason || !reason.trim()) return;
                              if (!window.confirm(
                                `⚠️ CONFIRMATION FINALE\n\nÉmettre définitivement un avoir Peppol pour la facture ${inv.invoice_number} ?\n\nMotif : ${reason.trim()}\n\nCette action est IRRÉVERSIBLE et sera transmise immédiatement au destinataire via le réseau Peppol.`,
                              )) return;
                              setCreditingId(inv.id);
                              const tId = toast.loading(`Émission de l'avoir Peppol pour ${inv.invoice_number}…`);
                              try {
                                const { data, error } = await supabase.functions.invoke("issue-peppol-credit-note", {
                                  body: { invoice_id: inv.id, invoice_type: inv.type === "commission" ? "commission" : "order", reason: reason.trim() },
                                });
                                let errBody: any = null;
                                if (error && (error as any).context && typeof (error as any).context.json === "function") {
                                  try { errBody = await (error as any).context.clone().json(); } catch { /* noop */ }
                                }
                                const failed = !!error || (data && data.ok === false);
                                if (failed) {
                                  const payload = errBody || data || {};
                                  const msg = payload.hint || payload.error || error?.message || "erreur inconnue";
                                  toast.error(`Échec émission avoir : ${msg}`, { id: tId, duration: 8000 });
                                } else {
                                  toast.success(`Avoir Peppol émis pour ${inv.invoice_number}`, { id: tId });
                                }
                              } catch (e: any) {
                                toast.error(`Échec émission avoir : ${e?.message || "erreur inconnue"}`, { id: tId, duration: 8000 });
                              } finally {
                                setCreditingId(null);
                                await Promise.all([
                                  queryClient.invalidateQueries({ queryKey: ["admin-order-invoices"] }),
                                  queryClient.invalidateQueries({ queryKey: ["admin-peppol-credit-notes-counts"] }),
                                  queryClient.invalidateQueries({ queryKey: ["peppol-credit-notes"] }),
                                ]);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ color: "#B45309" }}
                            title="Émettre une note de crédit Peppol pour cette facture"
                          >
                            {creditingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
                            {creditingId === inv.id ? "Émission…" : "Avoir"}
                          </button>
                        )}
                        {(creditNoteCounts[inv.id] || 0) > 0 && (
                          <button
                            onClick={() => setHistoryInvoice({ id: inv.id, number: inv.invoice_number })}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-slate-100"
                            style={{ color: "#616B7C" }}
                            title="Voir l'historique des avoirs Peppol émis"
                          >
                            <History size={11} /> Avoirs
                            <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
                              {creditNoteCounts[inv.id]}
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {inv.pdf_path && (
                        <button
                          onClick={async () => {
                            const { data, error } = await supabase.functions.invoke("get-invoice-signed-url", { body: { invoice_id: inv.id } });
                            if (error || !data?.signed_url) { toast.error("Impossible de générer le lien PDF"); return; }
                            window.open(data.signed_url, "_blank");
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-slate-100"
                          style={{ color: "#1B5BDA" }}
                        >
                          <Download size={12} /> PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoicesData.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-[12px]" style={{ color: "#8B95A5" }}>Aucune facture pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        </>
      )}


      {activeTab === "payouts" && (
        <VendorStatementsPanel vendors={vendors.filter((v: any) => v.is_active && v.type === "real")} />
      )}

      <PeppolCreditNotesDialog
        open={!!historyInvoice}
        onOpenChange={(o) => { if (!o) setHistoryInvoice(null); }}
        invoiceId={historyInvoice?.id ?? null}
        invoiceNumber={historyInvoice?.number ?? null}
      />
    </div>
  );
};

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function VendorStatementsPanel({ vendors }: { vendors: any[] }) {
  const now = new Date();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // mois précédent
  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(defaultMonth);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const yearsRange = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);

  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["admin-vendor-statements", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_statements")
        .select("*")
        .eq("period_year", year)
        .eq("period_month", month);
      if (error) throw error;
      return data || [];
    },
  });

  const byVendor = useMemo(() => {
    const map = new Map<string, any>();
    statements.forEach((s: any) => map.set(s.vendor_id, s));
    return map;
  }, [statements]);

  async function generate(vendorId: string) {
    setGeneratingId(vendorId);
    const t = toast.loading("Génération du relevé en cours…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-vendor-statement", {
        body: { vendor_id: vendorId, year, month, send_email: false },
      });
      toast.dismiss(t);
      if (error || (data && data.ok === false)) {
        toast.error(`Échec: ${error?.message || data?.error || "erreur inconnue"}`);
      } else {
        toast.success("Relevé généré");
        qc.invalidateQueries({ queryKey: ["admin-vendor-statements", year, month] });
      }
    } finally {
      setGeneratingId(null);
    }
  }

  async function download(pdfPath: string | null) {
    if (!pdfPath) return;
    const { data, error } = await supabase.storage
      .from("vendor-statements")
      .createSignedUrl(pdfPath, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Impossible de générer le lien du PDF");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const fmtEur = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-[#616B7C]">Période :</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-[13px] border border-[#E2E8F0] rounded px-2 py-1 bg-white"
          >
            {MONTHS_FR.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-[13px] border border-[#E2E8F0] rounded px-2 py-1 bg-white"
          >
            {yearsRange.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <span className="text-[11px] text-[#8B95A5]">
          {vendors.length} vendeur(s) actif(s) · {statements.length} relevé(s) généré(s)
        </span>
      </div>

      <div className="rounded-[10px] overflow-x-auto" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-[#8B95A5]">Chargement…</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Période", "Ventes brutes TTC", "Commission HT", "Net transféré", "PDF", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#8B95A5]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v: any) => {
                const s = byVendor.get(v.id);
                const label = `${MONTHS_FR[month - 1]} ${year}`;
                return (
                  <tr key={v.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#1B5BDA]">{v.company_name || v.name}</td>
                    <td className="px-4 py-3 text-[12px] text-[#616B7C]">{label}</td>
                    <td className="px-4 py-3 text-[12px] font-mono text-[#1D2530]">{s ? fmtEur(Number(s.total_gross_ttc)) : "—"}</td>
                    <td className="px-4 py-3 text-[12px] font-mono text-[#616B7C]">{s ? fmtEur(Number(s.total_commission_ht)) : "—"}</td>
                    <td className="px-4 py-3 text-[12px] font-mono font-bold text-[#059669]">{s ? fmtEur(Number(s.total_net_transferred)) : "—"}</td>
                    <td className="px-4 py-3">
                      {s?.pdf_path ? (
                        <button
                          onClick={() => download(s.pdf_path)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded hover:bg-slate-100 text-[#1B5BDA]"
                        >
                          <Download size={12} /> PDF
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#8B95A5]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">Généré</span>
                          <button
                            onClick={() => generate(v.id)}
                            disabled={generatingId === v.id}
                            className="text-[10px] text-[#8B95A5] hover:text-[#1B5BDA] underline"
                            title="Régénérer"
                          >
                            {generatingId === v.id ? "…" : "Régénérer"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => generate(v.id)}
                          disabled={generatingId === v.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-[#1B5BDA] text-white hover:bg-[#1749B8] disabled:opacity-50"
                        >
                          {generatingId === v.id ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                          Générer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[12px] text-[#8B95A5]">Aucun vendeur actif.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminFinances;
