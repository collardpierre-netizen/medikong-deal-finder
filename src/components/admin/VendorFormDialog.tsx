import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VENDOR_TYPES = [
  { value: "real", label: "Fournisseur réel", description: "Vendeur externe avec son propre stock" },
  { value: "medikong", label: "MediKong Direct", description: "Vendeur géré par MediKong" },
  { value: "qogita", label: "Qogita", description: "Vendeur via Qogita" },
] as const;

const COMMISSION_MODELS = [
  { value: "flat_percentage", label: "Pourcentage fixe", description: "Commission en % du prix de vente" },
  { value: "margin_split", label: "Partage de marge", description: "Partage de la marge nette (vente − achat)" },
  { value: "fixed_amount", label: "Montant fixe", description: "Commission fixe en € par unité vendue" },
] as const;

export default function VendorFormDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ vendor_id: string; temp_password: string | null; reused?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  type DupConflict = {
    message: string;
    existing_vendor: { id: string; name?: string; company_name?: string; email?: string; auth_user_id?: string | null };
    suggested_action: "attach_to_existing" | "open_existing";
  };
  const [duplicate, setDuplicate] = useState<DupConflict | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    phone: "",
    vat_number: "",
    address_line1: "",
    city: "",
    postal_code: "",
    country_code: "BE",
    commission_rate: "15",
    commission_model: "flat_percentage" as string,
    margin_split_pct: "50",
    fixed_commission_amount: "2",
    description: "",
    type: "real" as string,
    create_account: true,
  });

  const set = (key: string, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

  const resetForm = () => {
    setForm({ company_name: "", email: "", phone: "", vat_number: "", address_line1: "", city: "", postal_code: "", country_code: "BE", commission_rate: "15", commission_model: "flat_percentage", margin_split_pct: "50", fixed_commission_amount: "2", description: "", type: "real", create_account: true });
    setResult(null);
    setCopied(false);
    setDuplicate(null);
    setAttaching(false);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    if (form.create_account && !form.email.trim()) {
      toast.error("L'email est requis pour créer un compte");
      return;
    }
    setSaving(true);
    try {
      if (form.create_account && form.email.trim()) {
        // Use edge function to create auth account + vendor record
        const { data, error } = await supabase.functions.invoke("create-vendor-account", {
          body: {
            company_name: form.company_name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            vat_number: form.vat_number.trim() || null,
            address: [form.address_line1, form.city, form.postal_code, form.country_code].filter(Boolean).join(", ") || null,
            commission_rate: form.commission_rate,
            commission_model: form.commission_model,
            margin_split_pct: form.margin_split_pct,
            fixed_commission_amount: form.fixed_commission_amount,
            description: form.description.trim() || null,
            type: form.type,
          },
        });
        if (error) throw error;
        // Nouvelle convention edge: { ok: boolean, error?, code?, ... }
        if (data?.ok === false || data?.error) {
          // Doublon vendeur : proposer le rattachement
          if (data?.code === "vendor_email_already_exists" && data?.existing_vendor) {
            setDuplicate({
              message: data.error,
              existing_vendor: data.existing_vendor,
              suggested_action: data.suggested_action ?? "attach_to_existing",
            });
            return;
          }
          throw new Error(data?.error || "Erreur inconnue");
        }

        setResult({ vendor_id: data.vendor_id, temp_password: data.temp_password ?? null });
        toast.success("Vendeur créé avec compte d'accès !");
      } else {
        // Direct DB insert without auth account
        const slug = slugify(form.company_name);
        const { error } = await supabase.from("vendors").insert({
          name: form.company_name.trim(),
          slug,
          company_name: form.company_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          vat_number: form.vat_number.trim() || null,
          address_line1: form.address_line1.trim() || null,
          city: form.city.trim() || null,
          postal_code: form.postal_code.trim() || null,
          country_code: form.country_code || "BE",
          commission_rate: parseFloat(form.commission_rate) || 0,
          commission_model: form.commission_model as any,
          margin_split_pct: parseFloat(form.margin_split_pct) || 50,
          fixed_commission_amount: form.commission_model === 'fixed_amount' ? (parseFloat(form.fixed_commission_amount) || 0) : null,
          description: form.description.trim() || null,
          type: form.type as any,
          is_active: true,
          can_manage_offers: true,
        });
        if (error) throw error;
        toast.success("Vendeur créé (sans compte d'accès)");
        onOpenChange(false);
        resetForm();
      }
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = () => {
    if (result?.temp_password) {
      navigator.clipboard.writeText(result.temp_password);
      setCopied(true);
      toast.success("Mot de passe copié !");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAttach = async () => {
    if (!duplicate) return;
    setAttaching(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-vendor-account", {
        body: {
          vendor_id: duplicate.existing_vendor.id,
          company_name: duplicate.existing_vendor.company_name || duplicate.existing_vendor.name || form.company_name.trim(),
          email: form.email.trim(),
        },
      });
      if (error) throw error;
      if (data?.ok === false || data?.error) throw new Error(data?.error || "Erreur inconnue");

      setResult({
        vendor_id: data.vendor_id,
        temp_password: data.temp_password ?? null,
        reused: !!data.reused_existing_user,
      });
      setDuplicate(null);
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success("Accès rattaché au vendeur existant.");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du rattachement");
    } finally {
      setAttaching(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  // Conflict screen — vendeur existant détecté
  if (duplicate) {
    const ev = duplicate.existing_vendor;
    const canAttach = !ev.auth_user_id && duplicate.suggested_action === "attach_to_existing";
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-600" /> Vendeur déjà existant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">{duplicate.message}</p>

            <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <div>
                <span className="text-[11px] font-semibold uppercase text-amber-900">Vendeur existant</span>
                <p className="text-sm font-medium">{ev.company_name || ev.name}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-amber-900">Email</span>
                <p className="text-sm font-mono">{ev.email}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-amber-900">Accès portail</span>
                <p className="text-sm">{ev.auth_user_id ? "Déjà configuré" : "Aucun accès — rattachement possible"}</p>
              </div>
            </div>

            {canAttach ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Plutôt que de créer un doublon, vous pouvez rattacher cet email comme accès portail au vendeur existant.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDuplicate(null)} disabled={attaching}>
                    Modifier l'email
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleAttach} disabled={attaching}>
                    <Link2 size={14} />
                    {attaching ? "Rattachement…" : "Rattacher au vendeur existant"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Ce vendeur a déjà un accès portail. Modifiez l'email pour créer un autre vendeur, ou ouvrez la fiche existante.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDuplicate(null)}>
                    Modifier l'email
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      handleClose(false);
                      window.location.assign(`/admin/vendeurs/${ev.id}`);
                    }}
                  >
                    Ouvrir la fiche
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Success screen
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-green-600" /> Vendeur créé !
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Le compte a été créé. Communiquez ces identifiants au vendeur :
            </p>
            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div>
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Email</span>
                <p className="text-sm font-mono">{form.email}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Mot de passe temporaire</span>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-bold">{result.temp_password}</p>
                  <button onClick={copyPassword} className="p-1 rounded hover:bg-muted transition-colors">
                    {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} className="text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Le vendeur pourra se connecter sur <strong>/vendor/login</strong> et compléter son profil depuis les paramètres.
            </p>
            <button
              onClick={() => handleClose(false)}
              className="w-full py-2.5 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: "#1E293B" }}
            >
              Fermer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un vendeur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Type de vendeur *</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nom de l'entreprise *</Label>
            <Input value={form.company_name} onChange={e => set("company_name", e.target.value)} placeholder="Ex: Pharma Distribution SA" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@exemple.be" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+32 2 123 45 67" />
            </div>
          </div>

          <div>
            <Label>Numéro de TVA</Label>
            <Input value={form.vat_number} onChange={e => set("vat_number", e.target.value)} placeholder="BE0123456789" />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={form.address_line1} onChange={e => set("address_line1", e.target.value)} placeholder="Rue de la Loi 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Bruxelles" />
            </div>
            <div>
              <Label>Code postal</Label>
              <Input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="1000" />
            </div>
            <div>
              <Label>Pays</Label>
              <Input value={form.country_code} onChange={e => set("country_code", e.target.value)} placeholder="BE" />
            </div>
          </div>

          {/* Commission model */}
          <div>
            <Label>Modèle de commission *</Label>
            <Select value={form.commission_model} onValueChange={(v) => set("commission_model", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMISSION_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.commission_model === "flat_percentage" && (
            <div>
              <Label>Commission (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={e => set("commission_rate", e.target.value)} />
            </div>
          )}

          {form.commission_model === "margin_split" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Part vendeur (%)</Label>
                  <Input type="number" min="0" max="100" step="5" value={form.margin_split_pct} onChange={e => set("margin_split_pct", e.target.value)} />
                </div>
                <div>
                  <Label>Part MediKong (%)</Label>
                  <Input type="number" disabled value={String(100 - (parseFloat(form.margin_split_pct) || 0))} className="bg-muted" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                La marge nette = Prix de vente HTVA − Prix d'achat HTVA. Un prix d'achat devra être renseigné pour chaque offre.
              </p>
            </div>
          )}

          {form.commission_model === "fixed_amount" && (
            <div>
              <Label>Commission fixe (€ / unité)</Label>
              <Input type="number" min="0" step="0.5" value={form.fixed_commission_amount} onChange={e => set("fixed_commission_amount", e.target.value)} />
            </div>
          )}
          <div>
            <Label>Description</Label>
            <textarea
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-y"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Description du vendeur..."
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#F0F9FF", border: "1px solid #BAE6FD" }}>
            <input
              type="checkbox"
              checked={form.create_account}
              onChange={(e) => set("create_account", e.target.checked)}
              className="rounded"
              id="create-account"
            />
            <label htmlFor="create-account" className="text-sm cursor-pointer">
              <strong>Créer un compte d'accès</strong>
              <span className="text-muted-foreground ml-1 text-xs">— Le vendeur pourra se connecter au portail vendeur</span>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: "#1E293B" }}
          >
            {saving ? "Création en cours..." : "Créer le vendeur"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
