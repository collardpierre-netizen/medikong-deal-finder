import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Eye, Upload, X, FileText, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AUDIT_NOTIFICATION_EMAIL } from "@/config/audit";

type AuditStatus = "pending" | "in_progress" | "sent" | "declined";

interface AuditRequest {
  id: string;
  created_at: string;
  pharmacy_name: string;
  pharmacy_city: string | null;
  pharmacy_country: string | null;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone: string | null;
  pharmacy_address: string | null;
  pharmacy_postal_code: string | null;
  pharmacy_apb_number: string | null;
  pdf_storage_paths: string[];
  additional_notes: string | null;
  admin_notes: string | null;
  status: AuditStatus;
  report_pdf_url: string | null;
  economies_estimated_min: number | null;
  economies_estimated_max: number | null;
  sent_at: string | null;
}

const statusLabel: Record<AuditStatus, string> = {
  pending: "En attente",
  in_progress: "En cours",
  sent: "Envoyé",
  declined: "Décliné",
};
const statusColor: Record<AuditStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
  declined: "bg-slate-200 text-slate-700",
};

async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("audit-pdfs")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export default function AuditsAdminPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [selected, setSelected] = useState<AuditRequest | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [economiesMin, setEconomiesMin] = useState<string>("");
  const [economiesMax, setEconomiesMax] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-audits", statusFilter, fromDate],
    queryFn: async () => {
      let q = supabase
        .from("audit_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (fromDate) q = q.gte("created_at", fromDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRequest[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (args: { id: string; status: AuditStatus; extra?: Record<string, any> }) => {
      const { error } = await supabase
        .from("audit_requests")
        .update({ status: args.status, ...(args.extra || {}) })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-audits"] }),
  });

  const openSelected = async (row: AuditRequest) => {
    setSelected(row);
    setUploadFile(null);
    setEconomiesMin(row.economies_estimated_min?.toString() ?? "");
    setEconomiesMax(row.economies_estimated_max?.toString() ?? "");
    setAdminNotes(row.admin_notes ?? "");
  };

  const downloadFile = async (path: string) => {
    const url = await signedUrl(path);
    if (!url) {
      toast.error("Lien indisponible");
      return;
    }
    window.open(url, "_blank");
  };

  const sendReport = async () => {
    if (!selected) return;
    if (!uploadFile) {
      toast.error("Sélectionnez un PDF de rapport");
      return;
    }
    setBusy(true);
    try {
      const path = `${selected.id}/report-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("audit-pdfs")
        .upload(path, uploadFile, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("audit-pdfs")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      const reportUrl = signed?.signedUrl ?? "";

      await updateStatus.mutateAsync({
        id: selected.id,
        status: "sent",
        extra: {
          report_pdf_url: reportUrl,
          sent_at: new Date().toISOString(),
          economies_estimated_min: economiesMin ? Number(economiesMin) : null,
          economies_estimated_max: economiesMax ? Number(economiesMax) : null,
          admin_notes: adminNotes || null,
        },
      });

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "audit-report-ready",
          recipientEmail: selected.contact_email,
          idempotencyKey: `audit-${selected.id}-report-ready`,
          templateData: {
            firstName: selected.contact_first_name,
            pharmacyName: selected.pharmacy_name,
            reportUrl,
            economiesMin: economiesMin ? Number(economiesMin) : undefined,
            economiesMax: economiesMax ? Number(economiesMax) : undefined,
          },
        },
      });

      toast.success("Rapport envoyé au pharmacien");
      setSelected(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur lors de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateStatus.mutateAsync({
        id: selected.id,
        status: "declined",
        extra: { admin_notes: adminNotes || null },
      });
      toast.success("Demande déclinée");
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const markInProgress = async (row: AuditRequest) => {
    await updateStatus.mutateAsync({ id: row.id, status: "in_progress" });
    toast.success("Marqué en cours");
  };

  const [testingEmail, setTestingEmail] = useState(false);
  const sendTestEmail = async () => {
    setTestingEmail(true);
    try {
      const stamp = new Date().toISOString();
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "audit-new-lead",
          recipientEmail: AUDIT_NOTIFICATION_EMAIL,
          idempotencyKey: `audit-test-${Date.now()}`,
          templateData: {
            auditId: `TEST-${stamp}`,
            pharmacyName: "[TEST] Pharmacie de démonstration",
            contactName: "Test MediKong",
            contactEmail: AUDIT_NOTIFICATION_EMAIL,
            contactPhone: "+32 000 00 00 00",
            city: "Ath",
            country: "BE",
            filesCount: 0,
            files: [],
            notes: `Email de test envoyé depuis /admin/audits à ${stamp}. Aucune demande réelle n'a été créée.`,
          },
        },
      });
      if (error) throw error;
      toast.success(`Email de test envoyé à ${AUDIT_NOTIFICATION_EMAIL}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Échec de l'envoi du test");
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audits pharmaciens</h1>
          <p className="text-sm text-muted-foreground">
            Gestion des demandes d'audit reçues depuis /audit-achats
          </p>
        </div>
        <Button
          variant="outline"
          onClick={sendTestEmail}
          disabled={testingEmail}
          title={`Envoie un email de test au template audit-new-lead vers ${AUDIT_NOTIFICATION_EMAIL}`}
        >
          {testingEmail ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <MailCheck className="h-4 w-4 mr-2" />
          )}
          Test d'envoi → {AUDIT_NOTIFICATION_EMAIL}
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Status
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="declined">Décliné</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Depuis
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
          {(statusFilter !== "all" || fromDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setFromDate("");
              }}
            >
              Réinitialiser
            </Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            {rows?.length ?? 0} demande{(rows?.length ?? 0) > 1 ? "s" : ""}
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={18} /> Chargement…
          </div>
        ) : (rows?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Aucune demande pour ces filtres.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pharmacie</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell className="font-medium">{r.pharmacy_name}</TableCell>
                  <TableCell className="text-sm">
                    <div>{r.contact_first_name} {r.contact_last_name}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {[r.pharmacy_city, r.pharmacy_country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[r.status]}>{statusLabel[r.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <FileText size={14} className="text-muted-foreground" />
                      <span className="text-sm">{r.pdf_storage_paths?.length ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openSelected(r)}>
                        <Eye size={14} className="mr-1" /> Voir
                      </Button>
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => markInProgress(r)}>
                          En cours
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* DETAILS MODAL */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.pharmacy_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Contact</div>
                    <div>{selected.contact_first_name} {selected.contact_last_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <Badge className={statusColor[selected.status]}>
                      {statusLabel[selected.status]}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div>{selected.contact_email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Téléphone</div>
                    <div>{selected.contact_phone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">N° APB</div>
                    <div>{selected.pharmacy_apb_number || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Adresse</div>
                    <div>
                      {[
                        selected.pharmacy_address,
                        selected.pharmacy_postal_code,
                        selected.pharmacy_city,
                        selected.pharmacy_country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </div>
                  </div>
                </div>

                {selected.additional_notes && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Notes du pharmacien</div>
                    <div className="bg-slate-50 p-3 rounded text-xs">
                      {selected.additional_notes}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Factures uploadées ({selected.pdf_storage_paths?.length ?? 0})
                  </div>
                  <div className="space-y-1.5">
                    {selected.pdf_storage_paths?.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded text-xs"
                      >
                        <span className="truncate">{p.split("/").pop()}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadFile(p)}
                        >
                          <Download size={12} className="mr-1" /> Télécharger
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.status !== "sent" && selected.status !== "declined" && (
                  <div className="border-t pt-4 space-y-3">
                    <div className="font-medium text-sm">Envoyer le rapport</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Économies min (€/an)</label>
                        <Input
                          type="number"
                          value={economiesMin}
                          onChange={(e) => setEconomiesMin(e.target.value)}
                          placeholder="ex: 8000"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Économies max (€/an)</label>
                        <Input
                          type="number"
                          value={economiesMax}
                          onChange={(e) => setEconomiesMax(e.target.value)}
                          placeholder="ex: 14000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Notes internes (admin)</label>
                      <Textarea
                        rows={2}
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Rapport PDF généré
                      </label>
                      {uploadFile ? (
                        <div className="flex items-center justify-between bg-emerald-50 px-3 py-2 rounded text-xs">
                          <span className="truncate">
                            <FileText size={12} className="inline mr-1" />
                            {uploadFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setUploadFile(null)}
                            className="text-destructive"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        />
                      )}
                    </div>
                  </div>
                )}

                {selected.status === "sent" && selected.report_pdf_url && (
                  <div className="border-t pt-3 text-xs">
                    <div className="text-muted-foreground mb-1">Rapport envoyé</div>
                    <a
                      href={selected.report_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Voir le rapport
                    </a>
                    {selected.sent_at && (
                      <div className="text-muted-foreground mt-1">
                        Le {format(new Date(selected.sent_at), "dd MMM yyyy HH:mm", { locale: fr })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                {selected.status !== "sent" && selected.status !== "declined" && (
                  <>
                    <Button variant="outline" onClick={decline} disabled={busy}>
                      Décliner
                    </Button>
                    <Button onClick={sendReport} disabled={busy || !uploadFile}>
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} /> Envoi…
                        </>
                      ) : (
                        <>
                          <Upload size={16} className="mr-1.5" /> Envoyer le rapport
                        </>
                      )}
                    </Button>
                  </>
                )}
                {(selected.status === "sent" || selected.status === "declined") && (
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Fermer
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
