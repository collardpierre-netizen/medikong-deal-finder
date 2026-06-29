import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CUSTOMER_TYPE_OPTIONS } from "@/pages/admin/AdminCustomers";

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string;
  authUserId: string | null;
  onSaved?: (patch: Record<string, any>) => void;
}

const COUNTRIES = ["BE", "FR", "LU", "NL", "DE"];

export default function EditBuyerProfileDialog({ open, onClose, customerId, authUserId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [profileId, setProfileId] = useState<string>("");

  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: customer }, { data: profs }, { data: assign }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
        (supabase as any).from("user_profiles").select("id, name").eq("is_active", true).order("display_order"),
        authUserId
          ? (supabase as any).from("user_profile_assignments").select("profile_id").eq("user_id", authUserId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setForm(customer || {});
      setProfiles(profs || []);
      setProfileId(assign?.profile_id || "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, customerId, authUserId]);

  const save = async () => {
    if (!form?.company_name?.trim()) return toast.error("Raison sociale requise");
    setSaving(true);
    try {
      const patch: any = {
        company_name: form.company_name?.trim(),
        customer_type: form.customer_type || "pharmacy",
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

      if (authUserId && profileId) {
        const { error: errP } = await (supabase as any)
          .from("user_profile_assignments")
          .upsert({ user_id: authUserId, profile_id: profileId }, { onConflict: "user_id" });
        if (errP) throw errP;
      }

      toast.success("Fiche utilisateur mise à jour");
      onSaved?.(patch);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Éditer le profil pro</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Raison sociale *</Label>
                <Input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} maxLength={200} />
              </div>

              <div>
                <Label className="text-xs">Type de client</Label>
                <Select value={form.customer_type || "pharmacy"} onValueChange={(v) => setForm({ ...form, customer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            <div className="border-t pt-4">
              <Label className="text-xs">Profil de visibilité prix</Label>
              {!authUserId ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Aucun compte auth lié — impossible d'assigner un profil de visibilité. (Géré via <code>user_profile_assignments</code>.)
                </p>
              ) : (
                <>
                  <Select value={profileId} onValueChange={setProfileId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un profil…" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Détermine ce que l'utilisateur voit (prix grossiste/pharmacien/public, sources…). Configurable dans /admin/profils.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
