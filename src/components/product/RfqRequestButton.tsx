import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRfqQuota } from "@/hooks/useRfqQuota";
import RfqQuotaBadge from "@/components/rfq/RfqQuotaBadge";
import RfqPaywallDialog from "@/components/rfq/RfqPaywallDialog";

const COUNTRIES = [
  { code: "BE", label: "Belgique" }, { code: "FR", label: "France" },
  { code: "LU", label: "Luxembourg" }, { code: "NL", label: "Pays-Bas" }, { code: "DE", label: "Allemagne" },
];

const Schema = z.object({
  quantity: z.number().int().positive().max(1_000_000),
  target_price_eur: z.number().nonnegative().optional(),
  desired_delivery_date: z.string().optional(),
  destination_country_code: z.string().length(2),
  delivery_address: z.string().trim().max(500).optional(),
  payment_terms: z.string().trim().max(500).optional(),
  required_offer_validity_days: z.number().int().min(1).max(365).optional(),
  comment: z.string().trim().max(4000).optional(),
  target_scope: z.enum(["product_only", "brand_only", "product_and_brand"]),
});

interface Props {
  productId?: string | null;
  brandId?: string | null;
  productName?: string | null;
  brandName?: string | null;
}

export default function RfqRequestButton({ productId, brandId, productName, brandName }: Props) {
  const { user, isVerifiedBuyer } = useAuth();
  const qc = useQueryClient();
  const { data: quota } = useRfqQuota();
  const [open, setOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    quantity: "100",
    target_price_eur: "",
    desired_delivery_date: "",
    destination_country_code: "BE",
    delivery_address: "",
    payment_terms: "",
    required_offer_validity_days: "30",
    comment: "",
    target_scope: (productId && brandId ? "product_and_brand" : productId ? "product_only" : "brand_only") as
      "product_only" | "brand_only" | "product_and_brand",
  });

  const submit = useMutation({
    mutationFn: async () => {
      // Validation
      const parsed = Schema.safeParse({
        quantity: Number(form.quantity),
        target_price_eur: form.target_price_eur ? Number(form.target_price_eur) : undefined,
        desired_delivery_date: form.desired_delivery_date || undefined,
        destination_country_code: form.destination_country_code,
        delivery_address: form.delivery_address || undefined,
        payment_terms: form.payment_terms || undefined,
        required_offer_validity_days: form.required_offer_validity_days ? Number(form.required_offer_validity_days) : undefined,
        comment: form.comment || undefined,
        target_scope: form.target_scope,
      });
      if (!parsed.success) {
        const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
        throw new Error(first || "Formulaire invalide");
      }
      const v = parsed.data;

      // INSERT rfq
      const { data: rfq, error } = await supabase.from("rfqs").insert({
        buyer_user_id: user!.id,
        product_id: v.target_scope !== "brand_only" ? productId : null,
        brand_id: v.target_scope !== "product_only" ? brandId : null,
        target_scope: v.target_scope,
        quantity: v.quantity,
        target_price_excl_vat_cents: v.target_price_eur != null ? Math.round(v.target_price_eur * 100) : null,
        desired_delivery_date: v.desired_delivery_date ?? null,
        destination_country_code: v.destination_country_code,
        delivery_address: v.delivery_address ? { raw: v.delivery_address } : null,
        payment_terms: v.payment_terms ?? null,
        required_offer_validity_days: v.required_offer_validity_days ?? null,
        comment: v.comment ?? null,
      }).select("id").single();
      if (error) throw error;

      // Upload PJ
      for (const f of files) {
        const path = `rfq/${rfq.id}/${crypto.randomUUID()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("rfq-attachments").upload(path, f, { contentType: f.type });
        if (upErr) { toast.warning(`Pièce jointe '${f.name}' non envoyée : ${upErr.message}`); continue; }
        await supabase.from("rfq_attachments").insert({
          rfq_id: rfq.id, uploaded_by_user_id: user!.id, uploader_role: "buyer",
          storage_path: path, file_name: f.name, mime_type: f.type || "application/octet-stream",
          size_bytes: f.size,
        });
      }

      // Dispatch
      const { data: disp, error: dispErr } = await supabase.functions.invoke("dispatch-rfq", { body: { rfq_id: rfq.id } });
      if (dispErr) throw dispErr;
      return disp as { vendors_targeted: number; notifications_created: number };
    },
    onSuccess: (r) => {
      toast.success(`Demande envoyée à ${r.vendors_targeted} vendeur(s). Vous recevrez les meilleures offres dans votre espace.`);
      setOpen(false);
      setFiles([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user || !isVerifiedBuyer) return null;
  if (!productId && !brandId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag className="h-4 w-4" /> Demande de prix
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Demande de prix</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Votre demande sera envoyée à tous les vendeurs MediKong concernés. Les 3 meilleures offres vous seront remontées automatiquement.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {productId && brandId && (
            <div className="col-span-2">
              <Label>Cible</Label>
              <Select value={form.target_scope} onValueChange={(v: any) => setForm(p => ({ ...p, target_scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product_only">Vendeurs ayant ce produit ({productName})</SelectItem>
                  <SelectItem value="brand_only">Tous vendeurs de la marque ({brandName})</SelectItem>
                  <SelectItem value="product_and_brand">Les deux (élargi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Quantité *</Label>
            <Input type="number" min={1} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
          </div>
          <div>
            <Label>Prix cible HTVA (€/unité)</Label>
            <Input type="number" step="0.01" min={0} value={form.target_price_eur} onChange={e => setForm(p => ({ ...p, target_price_eur: e.target.value }))} />
          </div>
          <div>
            <Label>Date de livraison souhaitée</Label>
            <Input type="date" value={form.desired_delivery_date} onChange={e => setForm(p => ({ ...p, desired_delivery_date: e.target.value }))} />
          </div>
          <div>
            <Label>Pays livraison *</Label>
            <Select value={form.destination_country_code} onValueChange={v => setForm(p => ({ ...p, destination_country_code: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Adresse de livraison</Label>
            <Textarea rows={2} maxLength={500} value={form.delivery_address} onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))} />
          </div>
          <div>
            <Label>Conditions de paiement</Label>
            <Input maxLength={500} placeholder="ex : 30 jours net" value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} />
          </div>
          <div>
            <Label>Validité d'offre demandée (jours)</Label>
            <Input type="number" min={1} max={365} value={form.required_offer_validity_days} onChange={e => setForm(p => ({ ...p, required_offer_validity_days: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Commentaire</Label>
            <Textarea rows={3} maxLength={4000} placeholder="Conditionnement spécifique, exigences particulières…" value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
          </div>

          <div className="col-span-2">
            <Label>Pièces jointes (max 20 Mo / fichier)</Label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:underline">
              <Upload className="h-3.5 w-3.5" /> Ajouter un fichier
              <input type="file" className="hidden" multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.csv,.txt"
                onChange={e => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-muted/40 px-2 py-1 rounded">
                    <span className="truncate">{f.name} ({Math.round(f.size / 1024)} ko)</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submit.isPending}>Annuler</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer ma demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
