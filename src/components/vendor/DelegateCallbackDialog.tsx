import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneCall, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegateId: string;
  vendorId: string;
  delegateName: string;
}

const schema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").max(255),
  phone: z.string().trim().min(6, "Téléphone requis").max(40),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  preferred_slot: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export default function DelegateCallbackDialog({
  open,
  onOpenChange,
  delegateId,
  vendorId,
  delegateName,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company: "",
    email: "",
    phone: "",
    postal_code: "",
    preferred_slot: "",
    message: "",
  });

  const { data: customer } = useQuery({
    queryKey: ["dcr-prefill", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("customers")
        .select(
          "id, company_name, email, phone, postal_code, country_code, customer_type"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && open,
  });

  // Pré-remplir
  useEffect(() => {
    if (!open) return;
    const meta = (user?.user_metadata || {}) as any;
    setForm((f) => ({
      ...f,
      first_name: f.first_name || meta.first_name || "",
      last_name: f.last_name || meta.last_name || "",
      email: f.email || customer?.email || user?.email || "",
      phone: f.phone || customer?.phone || "",
      company: f.company || customer?.company_name || "",
      postal_code: f.postal_code || customer?.postal_code || "",
    }));
  }, [open, customer, user]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        map[i.path[0] as string] = i.message;
      });
      setErrors(map);
      return;
    }
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Connectez-vous pour envoyer une demande de rappel.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { data: inserted, error } = await supabase
      .from("delegate_callback_requests" as any)
      .insert({
        delegate_id: delegateId,
        vendor_id: vendorId,
        customer_id: customer?.id || null,
        auth_user_id: user.id,
        requester_first_name: parsed.data.first_name,
        requester_last_name: parsed.data.last_name,
        requester_company: parsed.data.company || null,
        requester_email: parsed.data.email,
        requester_phone: parsed.data.phone,
        buyer_profile: customer?.customer_type || null,
        country_code: customer?.country_code || null,
        postal_code: parsed.data.postal_code || null,
        preferred_slot: parsed.data.preferred_slot || null,
        message: parsed.data.message || null,
      })
      .select("id")
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Persister les coordonnées sur le compte pour pré-remplir les prochaines demandes.
    // L'échec ne bloque pas la demande de rappel, mais il est remonté à l'utilisateur.
    try {
      if (customer?.id) {
        const patch: Record<string, any> = {};
        if (parsed.data.phone && parsed.data.phone !== customer.phone) patch.phone = parsed.data.phone;
        if (parsed.data.postal_code && parsed.data.postal_code !== (customer as any).postal_code) patch.postal_code = parsed.data.postal_code;
        if (parsed.data.company && parsed.data.company !== (customer as any).company_name) patch.company_name = parsed.data.company;
        if (Object.keys(patch).length > 0) {
          const { error: patchError } = await supabase
            .from("customers")
            .update(patch as any)
            .eq("id", customer.id);
          if (patchError) {
            toast({
              title: "Coordonnées non enregistrées sur votre compte",
              description: patchError.message,
              variant: "destructive",
            });
          }
        }
      }
      const meta = (user.user_metadata || {}) as any;
      if (
        parsed.data.first_name !== meta.first_name ||
        parsed.data.last_name !== meta.last_name
      ) {
        await supabase.auth.updateUser({
          data: {
            ...meta,
            first_name: parsed.data.first_name,
            last_name: parsed.data.last_name,
          },
        });
      }
    } catch {
      /* best-effort */
    }

    // Notification email (best-effort) au délégué + vendeur
    try {
      const [{ data: dlgRaw }, { data: vnd }] = await Promise.all([
        supabase.rpc("get_vendor_delegate_contact" as any, { _id: delegateId }),
        supabase.from("vendors").select("email, contact_email, name").eq("id", vendorId).maybeSingle(),
      ]);
      const dlg = Array.isArray(dlgRaw) ? dlgRaw[0] : dlgRaw;
      const recipients = Array.from(new Set([
        (dlg as any)?.email,
        (vnd as any)?.contact_email,
        (vnd as any)?.email,
      ].filter(Boolean)));
      const templateData = {
        delegateName: dlg ? `${(dlg as any).first_name} ${(dlg as any).last_name}` : delegateName,
        requesterName: `${parsed.data.first_name} ${parsed.data.last_name}`,
        requesterCompany: parsed.data.company || undefined,
        requesterEmail: parsed.data.email,
        requesterPhone: parsed.data.phone,
        buyerProfile: customer?.customer_type || undefined,
        postalCode: parsed.data.postal_code || undefined,
        countryCode: customer?.country_code || undefined,
        preferredSlot: parsed.data.preferred_slot || undefined,
        message: parsed.data.message || undefined,
        ctaUrl: "https://medikong.pro/vendor/leads-rappel",
      };
      await Promise.all(
        recipients.map((to) =>
          supabase.functions.invoke("send-app-email", {
            body: {
              templateName: "vendor-delegate-callback",
              recipientEmail: to,
              idempotencyKey: `delegate-callback-${(inserted as any)?.id}-${to}`,
              templateData,
            },
          })
        )
      );
    } catch {
      /* best-effort */
    }
    setDone(true);
    toast({
      title: "Demande envoyée",
      description: `${delegateName} vous rappellera prochainement.`,
    });
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => setDone(false), 300);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall size={18} className="text-primary" />
            Demander à être rappelé
          </DialogTitle>
          <DialogDescription>
            {done
              ? `${delegateName} reçoit votre demande et vous rappellera.`
              : `${delegateName} vous rappellera au numéro indiqué.`}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <CheckCircle2 size={42} className="text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Votre demande a bien été transmise.
            </p>
            <Button onClick={close} className="mt-2">
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Prénom"
                value={form.first_name}
                onChange={(v) => set("first_name", v)}
                error={errors.first_name}
                required
              />
              <Field
                label="Nom"
                value={form.last_name}
                onChange={(v) => set("last_name", v)}
                error={errors.last_name}
                required
              />
            </div>
            <Field
              label="Société / pharmacie"
              value={form.company}
              onChange={(v) => set("company", v)}
              error={errors.company}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => set("email", v)}
                error={errors.email}
                required
              />
              <Field
                label="Téléphone"
                type="tel"
                value={form.phone}
                onChange={(v) => set("phone", v)}
                error={errors.phone}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Code postal"
                value={form.postal_code}
                onChange={(v) => set("postal_code", v)}
                error={errors.postal_code}
              />
              <Field
                label="Créneau préféré"
                placeholder="Ex. matin, lundi 14h…"
                value={form.preferred_slot}
                onChange={(v) => set("preferred_slot", v)}
                error={errors.preferred_slot}
              />
            </div>
            <div>
              <Label className="text-xs">Message (optionnel)</Label>
              <Textarea
                rows={3}
                maxLength={1000}
                value={form.message}
                placeholder="Sujet de votre demande, produits concernés…"
                onChange={(e) => set("message", e.target.value)}
              />
              {errors.message && (
                <p className="text-xs text-destructive mt-1">{errors.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={close} disabled={submitting}>
                Annuler
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Envoi…" : "Envoyer la demande"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Vos coordonnées seront transmises au délégué et au vendeur
              concerné pour qu'il vous recontacte.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={error ? "border-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
