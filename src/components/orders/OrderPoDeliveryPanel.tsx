import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type DeliverySite = {
  name?: string | null;
  address_l1?: string | null;
  address_l2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  delivery_hours?: string | null;
  delivery_instructions?: string | null;
};

const FIELDS: { key: keyof DeliverySite; label: string; placeholder?: string }[] = [
  { key: "name", label: "Nom du site" },
  { key: "address_l1", label: "Adresse" },
  { key: "address_l2", label: "Complément" },
  { key: "postal_code", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "country_code", label: "Pays", placeholder: "BE" },
  { key: "contact_name", label: "Contact sur place" },
  { key: "contact_phone", label: "Téléphone" },
  { key: "delivery_hours", label: "Horaires de réception", placeholder: "Lun–ven 8h–12h" },
];

export default function OrderPoDeliveryPanel({
  orderId,
  customerId,
  poNumbers,
  deliverySite,
}: {
  orderId: string;
  customerId: string | null;
  poNumbers: string | null;
  deliverySite: DeliverySite | null;
}) {
  const qc = useQueryClient();
  const [po, setPo] = useState(poNumbers ?? "");
  const [site, setSite] = useState<DeliverySite>(deliverySite ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => setPo(poNumbers ?? ""), [poNumbers]);
  useEffect(() => setSite(deliverySite ?? {}), [deliverySite]);

  const { data: addresses } = useQuery({
    queryKey: ["customer-shipping-addresses", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_shipping_addresses")
        .select("*")
        .eq("customer_id", customerId!)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const applyAddress = (id: string) => {
    const a = (addresses || []).find((x) => x.id === id);
    if (!a) return;
    setSite({
      name: a.label,
      address_l1: a.address_l1,
      address_l2: a.address_l2,
      postal_code: a.postal_code,
      city: a.city,
      country_code: a.country_code,
      contact_name: a.contact_name,
      contact_phone: a.contact_phone,
      delivery_hours: a.delivery_hours,
      delivery_instructions: a.delivery_instructions ?? a.notes,
    });
  };

  const save = async () => {
    setSaving(true);
    const cleaned = Object.fromEntries(
      Object.entries(site).map(([k, v]) => [k, typeof v === "string" && v.trim() ? v.trim() : null]),
    );
    const hasSite = Object.values(cleaned).some(Boolean);
    const { error } = await supabase
      .from("orders")
      .update({ po_numbers: po.trim() || null, delivery_site: hasSite ? cleaned : null } as any)
      .eq("id", orderId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ref PO client et site de livraison enregistrés");
...
      <div className="text-sm font-semibold">Ref PO client et site de livraison (repris sur le bon de commande fournisseur)</div>
...
        <label className="text-xs text-muted-foreground">Ref PO client (plusieurs possibles, séparées par des virgules)</label>
        <Input value={po} onChange={(e) => setPo(e.target.value)} placeholder="PO-12345, PO-12346" />
      </div>
      {(addresses?.length ?? 0) > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Reprendre un site enregistré du client</label>
          <select
            className="w-full h-9 border rounded-md px-2 text-sm bg-background"
            defaultValue=""
            onChange={(e) => e.target.value && applyAddress(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {addresses!.map((a) => (
              <option key={a.id} value={a.id}>
                {[a.label, a.address_l1, a.city].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-muted-foreground">{f.label}</label>
            <Input
              value={(site[f.key] as string) ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setSite((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Infos et modalités de livraison</label>
        <Textarea
          rows={3}
          value={site.delivery_instructions ?? ""}
          placeholder="Quai de déchargement, rendez-vous obligatoire, code d'accès, hayon…"
          onChange={(e) => setSite((s) => ({ ...s, delivery_instructions: e.target.value }))}
        />
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
