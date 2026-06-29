import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History, ArrowRight } from "lucide-react";
import { CUSTOMER_TYPE_OPTIONS } from "@/pages/admin/AdminCustomers";

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string;
  authUserId: string | null;
  onSaved?: (patch: Record<string, any>) => void;
}

const COUNTRIES = ["BE", "FR", "LU", "NL", "DE"];

type HistRow = {
  id: string;
  field_name: "customer_type" | "visibility_profile";
  old_label: string | null;
  new_label: string | null;
  reason: string;
  changed_by: string | null;
  changed_at: string;
};

const labelForCustomerType = (v?: string | null) =>
  CUSTOMER_TYPE_OPTIONS.find((o) => o.value === v)?.label || v || "—";

export default function EditBuyerProfileDialog({ open, onClose, customerId, authUserId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [initialType, setInitialType] = useState<string>("");
  const [initialProfileId, setInitialProfileId] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [history, setHistory] = useState<HistRow[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");

  const loadAll = async () => {
    setLoading(true);
    const [{ data: customer }, { data: profs }, { data: assign }, { data: hist }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
      (supabase as any).from("user_profiles").select("id, name").eq("is_active", true).order("display_order"),
      authUserId
        ? (supabase as any).from("user_profile_assignments").select("profile_id").eq("user_id", authUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase as any)
        .from("customer_profile_history")
        .select("id, field_name, old_label, new_label, reason, changed_by, changed_at")
        .eq("customer_id", customerId)
        .order("changed_at", { ascending: false })
        .limit(30),
    ]);
    setForm(customer || {});
    setInitialType(customer?.customer_type || "");
    setProfiles(profs || []);
    setProfileId(assign?.profile_id || "");
    setInitialProfileId(assign?.profile_id || "");
    setHistory(hist || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open || !customerId) return;
    loadAll();
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId, authUserId]);

  const typeChanged = (form.customer_type || "") !== initialType;
  const profileChanged = !!authUserId && profileId !== initialProfileId && !!profileId;
  const profileSensitiveChange = typeChanged || profileChanged;

  const saveCustomerFields = async () => {
    const patch: any = {
      company_name: form.company_name?.trim(),
      vat_number: form.vat_number?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      postal_code: form.postal_code?.trim() || null,
      city: form.city?.trim() || null,
      country_code: form.country_code || "BE",
    };
    const { error } = await supabase.from("customers").update(patch).eq("id", customerId);
    if (error) throw error;
    return patch;
  };

  const handleClickSave = async () => {
    if (!form?.company_name?.trim()) return toast.error("Raison sociale requise");
    if (profileSensitiveChange) {
      setConfirmOpen(true);
      return;
    }
    // Save coordonnées only
    setSaving(true);
    try {
      const patch = await saveCustomerFields();
      toast.success("Fiche mise à jour");
      onSaved?.(patch);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Échec");
    } finally {
      setSaving(false);
    }
  };

  const confirmAndSave = async () => {
    if (reason.trim().length < 3) {
      toast.error("Raison requise (min. 3 caractères)");
      return;
    }
    setSaving(true);
    try {
      const patch = await saveCustomerFields();
      const { error: rpcErr } = await (supabase as any).rpc("admin_change_buyer_profile", {
        _customer_id: customerId,
        _auth_user_id: authUserId,
        _new_customer_type: typeChanged ? form.customer_type : null,
        _new_profile_id: profileChanged ? profileId : null,
        _reason: reason.trim(),
      });
      if (rpcErr) throw rpcErr;
      toast.success("Profil pro mis à jour");
      onSaved?.({ ...patch, customer_type: form.customer_type });
      setConfirmOpen(false);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Échec");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Éditer le profil pro</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
          ) : (
            <div className="space-y-5 py-2">
              {/* Profil pro — bloc distinctif */}
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Profil professionnel</Label>
                  {profileSensitiveChange && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                      Changement en attente — raison requise
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type de client *</Label>
                    <Select value={form.customer_type || "pharmacy"} onValueChange={(v) => setForm({ ...form, customer_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {typeChanged && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        {labelForCustomerType(initialType)} <ArrowRight className="inline h-3 w-3" /> {labelForCustomerType(form.customer_type)}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Profil de visibilité prix</Label>
                    {!authUserId ? (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Aucun compte auth lié.
                      </p>
                    ) : (
                      <Select value={profileId} onValueChange={setProfileId}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Historique */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-medium">Historique des changements ({history.length})</Label>
                  </div>
                  {history.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Aucun changement enregistré.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {history.map((h) => (
                        <div key={h.id} className="text-[11px] bg-background border rounded p-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {h.field_name === "customer_type" ? "Type" : "Profil visibilité"}
                            </Badge>
                            <span className="font-medium">{h.old_label || "—"}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium text-primary">{h.new_label || "—"}</span>
                            <span className="text-muted-foreground ml-auto">{new Date(h.changed_at).toLocaleString("fr-BE")}</span>
                          </div>
                          <p className="text-muted-foreground mt-1 italic">« {h.reason} »</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Coordonnées */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Raison sociale *</Label>
                  <Input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} maxLength={200} />
                </div>
                <div>
                  <Label className="text-xs">N° TVA</Label>
                  <Input value={form.vat_number || ""} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} placeholder="BE0123456789" maxLength={32} />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
                </div>
                <div>
                  <Label className="text-xs">Téléphone</Label>
                  <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
                </div>
                <div />
                <div className="col-span-2">
                  <Label className="text-xs">Adresse facturation — ligne 1</Label>
                  <Input value={form.address_line1 || ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} maxLength={200} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Adresse facturation — ligne 2</Label>
                  <Input value={form.address_line2 || ""} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} maxLength={200} />
                </div>
                <div>
                  <Label className="text-xs">Code postal</Label>
                  <Input value={form.postal_code || ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} maxLength={20} />
                </div>
                <div>
                  <Label className="text-xs">Ville</Label>
                  <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={100} />
                </div>
                <div>
                  <Label className="text-xs">Pays</Label>
                  <Select value={form.country_code || "BE"} onValueChange={(v) => setForm({ ...form, country_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button onClick={handleClickSave} disabled={saving || loading}>
              {saving ? "Enregistrement…" : profileSensitiveChange ? "Continuer…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation modale */}
      <Dialog open={confirmOpen} onOpenChange={(v) => !v && !saving && setConfirmOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmer le changement de profil pro</DialogTitle>
            <DialogDescription>
              Ce changement sera tracé dans l'historique avec votre identifiant admin et la raison fournie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {typeChanged && (
              <div className="text-sm bg-muted/50 rounded p-2">
                <span className="text-xs text-muted-foreground">Type de client</span>
                <div className="flex items-center gap-2 mt-1">
                  <span>{labelForCustomerType(initialType)}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary">{labelForCustomerType(form.customer_type)}</span>
                </div>
              </div>
            )}
            {profileChanged && (
              <div className="text-sm bg-muted/50 rounded p-2">
                <span className="text-xs text-muted-foreground">Profil de visibilité prix</span>
                <div className="flex items-center gap-2 mt-1">
                  <span>{profiles.find((p) => p.id === initialProfileId)?.name || "—"}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary">{profiles.find((p) => p.id === profileId)?.name || "—"}</span>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Raison du changement * (min. 3 caractères)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. requalification suite à vérification SIRET / changement de statut juridique / erreur initiale de typologie…"
                rows={3}
                maxLength={500}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">{reason.trim().length}/500</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={confirmAndSave} disabled={saving || reason.trim().length < 3}>
              {saving ? "Application…" : "Confirmer et appliquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
