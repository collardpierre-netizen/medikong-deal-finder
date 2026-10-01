// Comptes acheteurs en attente de validation : du plus récent au plus ancien,
// avec temps d'attente. « Valider d'office » = même action que sur la fiche
// acheteur (is_verified + email « compte validé »). « Refuser » = même
// suppression que sur la page Utilisateurs.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logAdminAudit } from "@/lib/admin-audit";
import { UserCheck, UserX, Clock, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  email: string;
  company_name: string | null;
  customer_type: string | null;
  city: string | null;
  phone: string | null;
  created_at: string;
};

function waiting(from: string) {
  const ms = Date.now() - new Date(from).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

export default function AdminComptesEnAttente() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [refuse, setRefuse] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id, email, company_name, customer_type, city, phone, created_at")
      .eq("is_verified", false)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erreur : " + error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function validate(r: Row) {
    setBusy(r.id);
    const { data: updated, error } = await supabase
      .from("customers")
      .update({ is_verified: true } as any)
      .eq("id", r.id)
      .select("id, email, company_name")
      .maybeSingle();
    setBusy(null);
    if (error) { toast.error("Erreur : " + error.message); return; }
    if (!updated) { toast.error("Client introuvable ou déjà validé"); return; }
    toast.success(`${updated.company_name || updated.email} validé`);
    logAdminAudit("customer.verify", {
      targetId: updated.id, targetType: "customer",
      metadata: { email: updated.email, company_name: updated.company_name, source: "comptes-en-attente" },
    });
    if (updated.email) {
      supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "buyer-verified",
          recipientEmail: updated.email,
          idempotencyKey: `buyer-verified-${updated.id}`,
          templateData: { companyName: updated.company_name || undefined },
        },
      }).catch((e) => console.warn("buyer-verified email failed:", e));
    }
    setRows((p) => p.filter((x) => x.id !== r.id));
  }

  async function confirmRefuse() {
    if (!refuse) return;
    setBusy(refuse.id);
    const { error } = await supabase.from("customers").delete().eq("id", refuse.id);
    setBusy(null);
    if (error) { toast.error("Erreur : " + error.message); return; }
    toast.success("Compte refusé");
    setRows((p) => p.filter((x) => x.id !== refuse.id));
    setRefuse(null);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comptes en attente</h1>
          <p className="text-sm text-muted-foreground">{rows.length} compte(s) acheteur à valider, du plus récent au plus ancien.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw size={14} /> Actualiser</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucun compte en attente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="p-3">Société</th><th className="p-3">Email</th><th className="p-3">Type</th>
                <th className="p-3">Ville</th><th className="p-3">Inscrit le</th><th className="p-3">Attente</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-medium text-foreground">{r.company_name || "—"}</td>
                  <td className="p-3">{r.email}</td>
                  <td className="p-3">{r.customer_type || "—"}</td>
                  <td className="p-3">{r.city || "—"}</td>
                  <td className="p-3">{new Date(r.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="p-3"><span className="inline-flex items-center gap-1 text-muted-foreground"><Clock size={13} /> {waiting(r.created_at)}</span></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" disabled={busy === r.id} onClick={() => validate(r)} className="gap-1.5"><UserCheck size={14} /> Valider d'office</Button>
                      <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => setRefuse(r)} className="gap-1.5"><UserX size={14} /> Refuser</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {refuse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40" onClick={() => setRefuse(null)}>
          <div className="bg-card rounded-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground">Refuser {refuse.company_name || refuse.email} ?</h2>
            <p className="text-sm text-muted-foreground">La fiche client sera supprimée, comme le bouton « Refuser » de la page Utilisateurs. Action irréversible.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRefuse(null)}>Annuler</Button>
              <Button variant="destructive" disabled={busy === refuse.id} onClick={confirmRefuse}>Confirmer le refus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
