import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

interface PickupLocationForm {
  is_enabled: boolean;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country_code: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  instructions: string;
  hours: Record<string, string>;
}

const EMPTY: PickupLocationForm = {
  is_enabled: false,
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country_code: "BE",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  instructions: "",
  hours: { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" },
};

export default function RestockSellerPickupLocation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PickupLocationForm>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["restock-pickup-location", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_seller_pickup_locations")
        .select("*")
        .eq("seller_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      const hoursRaw = (data.hours as Record<string, string> | null) || {};
      setForm({
        is_enabled: !!data.is_enabled,
        address_line1: data.address_line1 || "",
        address_line2: data.address_line2 || "",
        postal_code: data.postal_code || "",
        city: data.city || "",
        country_code: data.country_code || "BE",
        contact_name: data.contact_name || "",
        contact_phone: data.contact_phone || "",
        contact_email: data.contact_email || "",
        instructions: data.instructions || "",
        hours: { ...EMPTY.hours, ...hoursRaw },
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not_authenticated");
      if (form.is_enabled) {
        if (!form.address_line1 || !form.postal_code || !form.city) {
          throw new Error("Adresse incomplète (rue, code postal, ville)");
        }
      }
      const payload = {
        seller_id: user.id,
        is_enabled: form.is_enabled,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        country_code: form.country_code || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        instructions: form.instructions || null,
        hours: form.hours,
      };
      const { error } = await supabase
        .from("restock_seller_pickup_locations")
        .upsert(payload, { onConflict: "seller_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coordonnées d'enlèvement enregistrées");
      queryClient.invalidateQueries({ queryKey: ["restock-pickup-location", user?.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur d'enregistrement"),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[#EBF0FB]">
          <MapPin size={22} className="text-[#1C58D9]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]">Enlèvement sur place</h1>
          <p className="text-sm text-[#5C6470]">Vos coordonnées de retrait, révélées à l'acheteur uniquement après paiement.</p>
        </div>
      </div>

      <div className="bg-[#EBF0FB]/60 border border-[#1C58D9]/20 rounded-lg p-3 mb-5 flex gap-2 text-xs text-[#1E252F]">
        <Info size={16} className="text-[#1C58D9] shrink-0 mt-0.5" />
        <p>
          Ces informations sont <strong>strictement privées</strong>. Elles ne sont jamais visibles sur vos annonces
          publiques. L'acheteur les reçoit uniquement après paiement, avec un code 6 chiffres et un QR code valables{" "}
          <strong>10 jours</strong>. Sans retrait dans ce délai, la transaction est annulée et l'acheteur écope d'une
          pénalité de 20€.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : (
        <div className="space-y-5">
          {/* Toggle */}
          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold text-[#1E252F]">Activer l'enlèvement sur place</Label>
              <p className="text-xs text-[#5C6470] mt-1">
                Les acheteurs pourront choisir "Enlèvement" au checkout sur vos annonces ReStock.
              </p>
            </div>
            <Switch
              checked={form.is_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_enabled: v }))}
            />
          </div>

          {/* Address */}
          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1E252F] mb-3 uppercase tracking-wider">Adresse de retrait</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs text-[#5C6470]">Rue + numéro *</Label>
                <Input
                  value={form.address_line1}
                  onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-[#5C6470]">Complément (étage, code porte…)</Label>
                <Input
                  value={form.address_line2}
                  onChange={(e) => setForm((f) => ({ ...f, address_line2: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-[#5C6470]">Code postal *</Label>
                <Input
                  value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-[#5C6470]">Ville *</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-[#5C6470]">Pays</Label>
                <Input
                  value={form.country_code}
                  onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toUpperCase() }))}
                  maxLength={2}
                  className="border-[#D0D5DC] rounded-lg uppercase"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1E252F] mb-3 uppercase tracking-wider">Contact sur place</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#5C6470]">Nom du contact</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-[#5C6470]">Téléphone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-[#5C6470]">Email (optionnel)</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Hours */}
          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1E252F] mb-1 uppercase tracking-wider">Horaires d'enlèvement</h2>
            <p className="text-xs text-[#8B929C] mb-3">Texte libre par jour, ex. "09:00 – 12:00 / 14:00 – 18:00". Laissez vide pour fermé.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DAYS.map((d) => (
                <div key={d.key} className="flex items-center gap-2">
                  <Label className="text-xs text-[#5C6470] w-20 shrink-0">{d.label}</Label>
                  <Input
                    value={form.hours[d.key] || ""}
                    onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.key]: e.target.value } }))}
                    placeholder="Fermé"
                    className="border-[#D0D5DC] rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1E252F] mb-2 uppercase tracking-wider">Instructions pour l'acheteur</h2>
            <Textarea
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              rows={4}
              placeholder="Ex : sonner à la pharmacie, demander le pharmacien titulaire, parking dans la cour…"
              className="border-[#D0D5DC] rounded-lg"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2"
            >
              {save.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
