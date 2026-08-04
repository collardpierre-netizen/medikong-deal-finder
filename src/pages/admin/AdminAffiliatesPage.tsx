// Admin — Liste des apporteurs d'affaires + KPIs globaux.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtCents, AFFILIATE_STATUS_LABELS } from "@/lib/affiliate-format";
import { Plus, Settings2, Search, Handshake } from "lucide-react";

type Row = {
  id: string; affiliate_code: string; display_name: string; company_name: string | null; email: string;
  status: string; user_id: string | null; last_payout_at: string | null;
  referrals_total: number; referrals_active: number; revenue_ht_cents: number;
  commissions_validated_cents: number; commissions_paid_cents: number; commissions_pending_cents: number;
};

type CronRun = {
  jobname: string; schedule: string | null; last_start: string | null;
  last_end: string | null; last_status: string | null; last_message: string | null;
};

const CRON_JOBS = [
  { name: "affiliate-validate-daily", label: "Validation quotidienne des commissions" },
  { name: "affiliate-payout-monthly", label: "Facturation mensuelle (self-billing)" },
];

export default function AdminAffiliatesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "", company_name: "", vat_number: "" });

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["admin-affiliates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_admin_list");
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (q.trim() === "" ||
            [r.display_name, r.company_name, r.email, r.affiliate_code]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q.toLowerCase()))),
      ),
    [rows, q, status],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          active: acc.active + (r.status === "active" ? 1 : 0),
          revenue: acc.revenue + Number(r.revenue_ht_cents ?? 0),
          pending: acc.pending + Number(r.commissions_pending_cents ?? 0),
          validated: acc.validated + Number(r.commissions_validated_cents ?? 0),
          paid: acc.paid + Number(r.commissions_paid_cents ?? 0),
        }),
        { active: 0, revenue: 0, pending: 0, validated: 0, paid: 0 },
      ),
    [rows],
  );

  const { data: cronRuns = [] } = useQuery<CronRun[]>({
    queryKey: ["affiliate-cron-last-runs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_cron_last_runs");
      if (error) throw error;
      return (data as CronRun[]) ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-affiliate", {
        body: { action: "create", ...form },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Apporteur créé et invitation envoyée");
      setOpen(false);
      setForm({ display_name: "", email: "", company_name: "", vat_number: "" });
      qc.invalidateQueries({ queryKey: ["admin-affiliates"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Handshake className="h-6 w-6" /> Apporteurs d'affaires
          </h1>
          <p className="text-sm text-muted-foreground">Montants HTVA.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/apporteurs/regles"><Settings2 className="h-4 w-4 mr-1" /> Règles de commission</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nouvel apporteur</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvel apporteur</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nom affiché *</Label>
                  <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
                <div><Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Société</Label>
                  <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
                <div><Label>Numéro de TVA</Label>
                  <Input value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">
                  Un lien d'activation est envoyé par email. Le code apporteur et le lien permanent sont générés automatiquement.
                </p>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!form.display_name.trim() || !form.email.trim() || create.isPending}
                >
                  Créer et inviter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Apporteurs actifs", value: String(totals.active) },
          { label: "CA HTVA apporté", value: fmtCents(totals.revenue) },
          { label: "Commissions en attente", value: fmtCents(totals.pending) },
          { label: "À payer (validées)", value: fmtCents(totals.validated) },
          { label: "Déjà payées", value: fmtCents(totals.paid) },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-xl font-semibold mt-1">{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">
            Tâches automatiques (heures UTC : 02:00 quotidien, 03:00 le 1er du mois)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CRON_JOBS.map((job) => {
              const run = cronRuns.find((r) => r.jobname === job.name);
              return (
                <div key={job.name} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{job.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{run?.schedule ?? "non planifié"}</p>
                  {run?.last_start ? (
                    <p className="text-xs mt-1">
                      Dernier run : {new Date(run.last_start).toLocaleString("fr-BE")} ·{" "}
                      <Badge className={run.last_status === "succeeded" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {run.last_status ?? "—"}
                      </Badge>
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-muted-foreground">Aucun run enregistré.</p>
                  )}
                  {run?.last_message && (
                    <p className="text-[11px] text-muted-foreground mt-1 break-all">{run.last_message}</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>



      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un apporteur…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(AFFILIATE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Apporteur</th>
                <th className="p-3">Code</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Clients</th>
                <th className="p-3 text-right">Clients actifs</th>
                <th className="p-3 text-right">CA HTVA</th>
                <th className="p-3 text-right">En attente</th>
                <th className="p-3 text-right">À payer</th>
                <th className="p-3 text-right">Payées</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = AFFILIATE_STATUS_LABELS[r.status] ?? { label: r.status, className: "" };
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <Link to={`/admin/apporteurs/${r.id}`} className="text-primary hover:underline font-medium">
                        {r.display_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.company_name || r.email}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">{r.affiliate_code}</td>
                    <td className="p-3"><Badge className={st.className}>{st.label}</Badge></td>
                    <td className="p-3 text-right">{r.referrals_total}</td>
                    <td className="p-3 text-right">{r.referrals_active}</td>
                    <td className="p-3 text-right">{fmtCents(r.revenue_ht_cents)}</td>
                    <td className="p-3 text-right">{fmtCents(r.commissions_pending_cents)}</td>
                    <td className="p-3 text-right font-medium">{fmtCents(r.commissions_validated_cents)}</td>
                    <td className="p-3 text-right">{fmtCents(r.commissions_paid_cents)}</td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Aucun apporteur.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
