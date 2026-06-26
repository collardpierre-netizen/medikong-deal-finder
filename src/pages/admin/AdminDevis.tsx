import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtEur } from "@/lib/format-currency";
import { FileText, Send, Clock, CheckCircle2, XCircle, ArrowRightCircle, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#F1F5F9", color: "#475569", label: "Brouillon" },
  sent: { bg: "#DBEAFE", color: "#1D4ED8", label: "Envoyé" },
  accepted: { bg: "#DCFCE7", color: "#15803D", label: "Accepté" },
  declined: { bg: "#FEE2E2", color: "#B91C1C", label: "Refusé" },
  paid: { bg: "#FEF3C7", color: "#A16207", label: "Payé" },
  converted: { bg: "#EDE9FE", color: "#6D28D9", label: "Converti" },
};


const AdminDevis = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dupBusy, setDupBusy] = useState<string | null>(null);

  const duplicateQuote = async (quoteId: string) => {
    setDupBusy(quoteId);
    try {
      const { data, error } = await supabase.rpc("admin_duplicate_quote" as any, { _quote_id: quoteId });
      if (error) throw error;
      toast.success("Devis dupliqué");
      await queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      if (data) navigate(`/admin/devis/${data}`);
    } catch (e: any) {
      toast.error(e?.message || "Échec duplication");
    } finally {
      setDupBusy(null);
    }
  };

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, status, total_ttc_cents, currency_code, created_at, sent_at, viewed_at, accepted_at, declined_at, token_expires_at, vendor:vendors(name, company_name), customer:customers(company_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const buyer = (q.customer?.company_name || "").toLowerCase();
        const seller = (q.vendor?.company_name || q.vendor?.name || "").toLowerCase();
        if (!q.quote_number.toLowerCase().includes(s) && !buyer.includes(s) && !seller.includes(s)) return false;
      }
      return true;
    });
  }, [quotes, search, statusFilter]);

  const kpis = useMemo(() => {
    const total = quotes.length;
    const sent = quotes.filter((q) => q.status === "sent").length;
    const accepted = quotes.filter((q) => q.status === "accepted" || q.status === "converted").length;
    const declined = quotes.filter((q) => q.status === "declined").length;
    const totalValueTtc = quotes.reduce((a, q) => a + Number(q.total_ttc_cents || 0), 0);
    const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    return { total, sent, accepted, declined, totalValueTtc, acceptanceRate };
  }, [quotes]);

  const tabs = [
    { key: "all", label: `Tous (${quotes.length})` },
    { key: "draft", label: `Brouillons (${quotes.filter(q => q.status === "draft").length})` },
    { key: "sent", label: `Envoyés (${quotes.filter(q => q.status === "sent").length})` },
    { key: "accepted", label: `Acceptés (${quotes.filter(q => q.status === "accepted").length})` },
    { key: "declined", label: `Refusés (${quotes.filter(q => q.status === "declined").length})` },
    { key: "converted", label: `Convertis (${quotes.filter(q => q.status === "converted").length})` },
  ];

  return (
    <div>
      <AdminTopBar title="Devis" subtitle="Suivi des devis envoyés aux acheteurs" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <KpiCard label="Total devis" value={String(kpis.total)} icon={FileText} />
        <KpiCard label="Envoyés" value={String(kpis.sent)} icon={Send} />
        <KpiCard label="Acceptés" value={String(kpis.accepted)} icon={CheckCircle2} />
        <KpiCard label="Taux d'acceptation" value={`${kpis.acceptanceRate}%`} icon={ArrowRightCircle} />
        <KpiCard label="Valeur cumulée TTC" value={`${fmtEur(kpis.totalValueTtc / 100)} €`} icon={Clock} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 text-xs rounded-full border ${statusFilter === t.key ? "text-white" : "bg-white text-slate-600"}`}
            style={statusFilter === t.key ? { backgroundColor: "#1C58D9", borderColor: "#1C58D9" } : { borderColor: "#E2E8F0" }}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto w-64">
          <Input placeholder="Rechercher (n°, acheteur, vendeur)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-lg border" style={{ borderColor: "#E2E8F0" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#F8FAFC" }}>
            <tr>
              {["N°", "Acheteur", "Vendeur", "Total TTC", "Statut", "Envoyé", "Vu", "Date", ""].map((h, i) => (
                <th key={`${h}-${i}`} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8B95A5" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10">Aucun devis</td></tr>
            ) : filtered.map((q) => {
              const s = STATUS_STYLES[q.status] ?? STATUS_STYLES.draft;
              return (
                <tr key={q.id} className="border-t hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/devis/${q.id}`} className="font-medium text-sky-700 hover:underline">{q.quote_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{q.customer?.company_name || "—"}</td>
                  <td className="px-4 py-2.5">{q.vendor?.company_name || q.vendor?.name || "—"}</td>
                  <td className="px-4 py-2.5 font-medium">{fmtEur(Number(q.total_ttc_cents || 0) / 100)} €</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{q.sent_at ? new Date(q.sent_at).toLocaleDateString("fr-BE") : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{q.viewed_at ? new Date(q.viewed_at).toLocaleDateString("fr-BE") : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(q.created_at).toLocaleDateString("fr-BE")}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => duplicateQuote(q.id)}
                      disabled={dupBusy === q.id}
                      title="Dupliquer ce devis"
                      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 text-slate-500 hover:text-sky-700 disabled:opacity-50"
                    >
                      <Copy size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDevis;
