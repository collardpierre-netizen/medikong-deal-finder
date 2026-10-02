import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { logAdminAudit } from "@/lib/admin-audit";
import { Trash2 } from "lucide-react";

type VendorOpt = { id: string; label: string };

function useRealVendors(enabled: boolean) {
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  useEffect(() => {
    if (!enabled) return;
    supabase
      .from("vendors")
      .select("id, company_name, name, type, is_active")
      .eq("is_active", true)
      .order("company_name")
      .then(({ data }) => {
        setVendors(
          (data || [])
            .filter((v: any) => v.type !== "qogita" && v.type !== "qogita_virtual")
            .map((v: any) => ({ id: v.id, label: v.company_name || v.name || v.id })),
        );
      });
  }, [enabled]);
  return vendors;
}

/** Applique des conditions « sur facture » d'un fournisseur à plusieurs acheteurs. */
export function BulkInvoiceTermsDialog({
  open, onOpenChange, customers, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customers: { id: string; company: string }[];
  onDone?: () => void;
}) {
  const vendors = useRealVendors(open);
  const [vendorId, setVendorId] = useState("");
  const [netDays, setNetDays] = useState(30);
  const [issuer, setIssuer] = useState<"vendor" | "medikong">("vendor");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!vendorId) return toast.error("Choisissez un fournisseur");
    if (!customers.length) return toast.error("Aucun acheteur sélectionné");
    if (netDays < 0 || netDays > 180) return toast.error("Délai entre 0 et 180 jours");
    const limitCents = limit.trim() ? Math.round(Number(limit.replace(",", ".")) * 100) : null;
    if (limitCents !== null && (!Number.isFinite(limitCents) || limitCents < 0)) return toast.error("Plafond invalide");
    setSaving(true);
    try {
      const { error: sErr } = await supabase
        .from("vendor_invoice_payment_settings")
        .upsert({ vendor_id: vendorId, enabled: true }, { onConflict: "vendor_id" });
      if (sErr) throw sErr;
      const ids = customers.map((c) => c.id);
      // Une règle par acheteur : on remplace l'éventuelle règle existante.
      const { error: dErr } = await supabase
        .from("vendor_invoice_payment_rules")
        .delete()
        .eq("vendor_id", vendorId)
        .in("customer_id", ids);
      if (dErr) throw dErr;
      const vendorLabel = vendors.find((v) => v.id === vendorId)?.label || "";
      const { error: iErr } = await supabase.from("vendor_invoice_payment_rules").insert(
        customers.map((c) => ({
          vendor_id: vendorId,
          customer_id: c.id,
          label: `Facture ${netDays} j — ${c.company}`,
          enabled: true,
          priority: 200,
          net_days: netDays,
          invoice_issuer: issuer,
          credit_limit_cents: limitCents,
        })),
      );
      if (iErr) throw iErr;
      await logAdminAudit("bulk_invoice_terms", {
        targetType: "vendor",
        targetId: vendorId,
        metadata: { vendor: vendorLabel, customers: ids.length, net_days: netDays, issuer, credit_limit_cents: limitCents },
      });
      toast.success(`Conditions appliquées à ${ids.length} acheteur${ids.length > 1 ? "s" : ""}`);
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Conditions non enregistrées", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conditions de paiement — {customers.length} acheteur{customers.length > 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">
            Les produits de ce fournisseur pourront être commandés sur facture. Le reste du panier est payé par carte ou virement.
          </p>
          <label className="block">
            <span className="text-xs font-semibold">Fournisseur</span>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background">
              <option value="">— Choisir —</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold">Échéance (jours)</span>
            <Input type="number" min={0} max={180} value={netDays} onChange={(e) => setNetDays(parseInt(e.target.value) || 0)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold">Facture émise par</span>
            <select value={issuer} onChange={(e) => setIssuer(e.target.value as any)} className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background">
              <option value="vendor">Le fournisseur</option>
              <option value="medikong">MediKong pour le compte du fournisseur</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold">Plafond d'encours TTC (€, facultatif)</span>
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Aucun plafond" />
          </label>
          <p className="text-[11px] text-muted-foreground">
            {customers.slice(0, 5).map((c) => c.company).join(", ")}{customers.length > 5 ? ` et ${customers.length - 5} autres` : ""}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Appliquer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Encart fiche acheteur : règles « sur facture » qui le concernent. */
export function BuyerInvoiceRulesCard({ customerId, refreshKey }: { customerId: string; refreshKey?: number }) {
  const [rules, setRules] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("vendor_invoice_payment_rules")
      .select("id, net_days, invoice_issuer, credit_limit_cents, enabled, vendor:vendors(company_name, name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    setRules(data || []);
  };
  useEffect(() => { load(); }, [customerId, refreshKey]);

  const remove = async (id: string) => {
    if (!confirm("Retirer cette condition de paiement ?")) return;
    const { error } = await supabase.from("vendor_invoice_payment_rules").delete().eq("id", id);
    if (error) return toast.error("Suppression impossible", { description: error.message });
    toast.success("Condition retirée");
    load();
  };

  return (
    <div className="py-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Paiement sur facture</h3>
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune condition spécifique.</p>
      ) : (
        <ul className="space-y-1.5">
          {rules.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-xs border border-border rounded-md px-2 py-1.5">
              <div>
                <p className="font-semibold text-foreground">{r.vendor?.company_name || r.vendor?.name || "Fournisseur"}{!r.enabled && " (désactivée)"}</p>
                <p className="text-muted-foreground">
                  {r.net_days} jours · facture {r.invoice_issuer === "medikong" ? "MediKong pour compte" : "fournisseur"}
                  {r.credit_limit_cents != null ? ` · plafond ${(r.credit_limit_cents / 100).toFixed(2)} €` : ""}
                </p>
              </div>
              <button onClick={() => remove(r.id)} className="text-destructive" aria-label="Retirer"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
