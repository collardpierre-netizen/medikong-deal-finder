import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, ExternalLink, ScanLine, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import AdminSavingsByPharmacy from "@/components/admin/AdminSavingsByPharmacy";

type Sim = {
  id: string;
  email: string | null;
  pharmacy_name: string | null;
  source_supplier: string | null;
  source_file_type: string | null;
  total_lines: number | null;
  matched_lines: number | null;
  match_rate: number | null;
  catalog_match_rate: number | null;
  source_total_excl_vat: number | null;
  medikong_total_excl_vat: number | null;
  savings_amount: number | null;
  savings_pct: number | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
  created_via: string | null;
  sent_at: string | null;
};


const fmtEur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(n));
const fmtPct = (n: number | null) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
// Taux de correspondance catalogue : `catalog_match_rate` est déjà en %.
// Fallback rétrocompatible pour les anciennes lignes qui n'ont que `match_rate` (fraction 0–1).
const catalogMatchPct = (r: Sim) =>
  r.catalog_match_rate != null ? Number(r.catalog_match_rate) : r.match_rate != null ? Number(r.match_rate) * 100 : null;

export default function AdminSavingsOcr() {
  const [rows, setRows] = useState<Sim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "failed" | "pending" | "ready_to_send" | "sent">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [form, setForm] = useState({ email: "", pharmacy_name: "", city: "", supplier: "febelco" });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    let q = (supabase as any)
      .from("savings_simulations")
      .select(
        "id,email,pharmacy_name,source_supplier,source_file_type,total_lines,matched_lines,match_rate,catalog_match_rate,source_total_excl_vat,medikong_total_excl_vat,savings_amount,savings_pct,status,error_message,created_at,created_via,sent_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data as Sim[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  // Analyse manuelle créée par un admin pour un client : aucun email automatique.
  async function createManual() {
    if (!file || !form.email.trim() || !form.pharmacy_name.trim()) {
      toast.error("Fichier, email et nom de pharmacie sont requis");
      return;
    }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("email", form.email.trim());
      fd.append("pharmacy_name", form.pharmacy_name.trim());
      if (form.city.trim()) fd.append("city", form.city.trim());
      fd.append("source_supplier", form.supplier);
      fd.append("consent_given", "true");
      fd.append("created_via", "admin_manual");
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-savings-upload`, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.session?.access_token ?? ""}`,
        },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Analyse lancée — aucun email envoyé au client");
      setDialogOpen(false);
      setFile(null);
      setTimeout(() => void load(), 1500);
    } catch (e) {
      toast.error("Création impossible");
      console.error("[admin-savings] manual create", e);
    } finally {
      setCreating(false);
    }
  }

  async function sendToClient(r: Sim) {
    if (!r.email) {
      toast.error("Aucun email sur cette analyse");
      return;
    }
    setSendingId(r.id);
    const { error } = await supabase.functions.invoke("generate-savings-report", {
      body: { simulation_id: r.id, email: r.email },
    });
    if (!error) {
      await (supabase as any).rpc("admin_savings_mark_sent", { _simulation_id: r.id });
      toast.success("Rapport envoyé au client");
      void load();
    } else {
      toast.error("Envoi impossible");
    }
    setSendingId(null);
  }

  /** Génère le PDF sans envoyer d'email et l'ouvre dans un nouvel onglet. */
  async function previewReport(r: Sim) {
    if (!r.email) {
      toast.error("Aucun email sur cette analyse");
      return;
    }
    setPreviewId(r.id);
    const { data, error } = await supabase.functions.invoke("generate-savings-report", {
      body: { simulation_id: r.id, email: r.email, preview: true },
    });
    setPreviewId(null);
    const url = (data as any)?.signed_url;
    if (error || !url) {
      toast.error("Aperçu impossible");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }




  return (
    <div className="container mx-auto py-8 space-y-6 max-w-7xl">
      <Helmet>
        <title>OCR — Calcul d'économies | MediKong Admin</title>
      </Helmet>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ScanLine className="h-7 w-7" />
            OCR — Calcul d'économies
          </h1>
          <p className="text-muted-foreground mt-1">
            Historique des analyses OCR de commandes uploadées sur <code>/economies</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">Tous les statuts</option>
            <option value="completed">Terminés</option>
            <option value="ready_to_send">À envoyer</option>
            <option value="sent">Envoyés</option>
            <option value="pending">En cours</option>
            <option value="failed">Échecs</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Actualiser
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4 mr-2" /> Analyse manuelle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle analyse pour un client</DialogTitle>
                <DialogDescription>
                  Aucun email n'est envoyé automatiquement : l'analyse reste « à envoyer » jusqu'à validation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ms-file">Bon de commande (PDF, image, CSV)</Label>
                  <Input
                    id="ms-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ms-email">Email du client</Label>
                  <Input
                    id="ms-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ms-pharma">Pharmacie</Label>
                  <Input
                    id="ms-pharma"
                    value={form.pharmacy_name}
                    onChange={(e) => setForm((f) => ({ ...f, pharmacy_name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ms-city">Ville</Label>
                    <Input
                      id="ms-city"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ms-supplier">Grossiste</Label>
                    <select
                      id="ms-supplier"
                      value={form.supplier}
                      onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                      className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="febelco">Febelco</option>
                      <option value="cerp">CERP</option>
                      <option value="pharma_belgium">Pharma Belgium</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void createManual()} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Lancer l'analyse
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button asChild size="sm">
            <Link to="/economies" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Ouvrir /economies
            </Link>
          </Button>
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} analyse(s)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune analyse trouvée.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Pharmacie</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3 text-right">Lignes</th>
                  <th className="py-2 pr-3 text-right">Match</th>
                  <th className="py-2 pr-3 text-right">Total source</th>
                  <th className="py-2 pr-3 text-right">Total MK</th>
                  <th className="py-2 pr-3 text-right">Économies</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Action</th>

                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("fr-BE")}</td>
                    <td className="py-2 pr-3">{r.email ?? "—"}</td>
                    <td className="py-2 pr-3">{r.pharmacy_name ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs">{r.source_supplier ?? "—"}</span>
                      {r.source_file_type && (
                        <span className="ml-1 text-[10px] text-muted-foreground uppercase">{r.source_file_type}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {r.matched_lines ?? 0}/{r.total_lines ?? 0}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmtPct(catalogMatchPct(r))}</td>
                    <td className="py-2 pr-3 text-right">{fmtEur(r.source_total_excl_vat)}</td>
                    <td className="py-2 pr-3 text-right">{fmtEur(r.medikong_total_excl_vat)}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={Number(r.savings_amount ?? 0) > 0 ? "text-emerald-600 font-semibold" : ""}>
                        {fmtEur(r.savings_amount)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{fmtPct(r.savings_pct)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          r.status === "completed" || r.status === "done" || r.status === "sent"
                            ? "default"
                            : r.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.status ?? "—"}
                      </Badge>
                      {r.created_via === "admin_manual" && (
                        <span className="ml-1 text-[10px] text-muted-foreground uppercase">manuelle</span>
                      )}
                      {r.error_message && (
                        <p className="text-[10px] text-destructive mt-1 max-w-xs truncate" title={r.error_message}>
                          {r.error_message}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {["ready_to_send", "done", "completed", "sent"].includes(String(r.status)) && r.email ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={previewId === r.id}
                            onClick={() => void previewReport(r)}
                          >
                            {previewId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : null}
                            Aperçu
                          </Button>
                          <Button
                            size="sm"
                            variant={r.status === "sent" ? "outline" : "default"}
                            disabled={sendingId === r.id}
                            onClick={() => void sendToClient(r)}
                          >
                            {sendingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {r.status === "sent" ? "Renvoyer" : "Envoyer"}
                          </Button>
                        </div>
                      ) : (

                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {r.sent_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(r.sent_at).toLocaleString("fr-BE")}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AdminSavingsByPharmacy />
    </div>

  );
}
