import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2, Globe, Truck, ShieldCheck, Package } from "lucide-react";

const COUNTRIES = [
  { code: "BE", label: "🇧🇪 Belgique" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "LU", label: "🇱🇺 Luxembourg" },
  { code: "NL", label: "🇳🇱 Pays-Bas" },
  { code: "DE", label: "🇩🇪 Allemagne" },
];

const CUSTOMER_TYPES = [
  { key: "pharmacy", label: "Pharmacie" },
  { key: "hospital", label: "Hôpital" },
  { key: "nursing_home", label: "Maison de repos" },
  { key: "dentist", label: "Dentiste" },
  { key: "nurse", label: "Infirmier(e)" },
  { key: "veterinary", label: "Vétérinaire" },
  { key: "wholesaler", label: "Grossiste" },
];

const SHIPPING_ZONES = ["Benelux", "France", "Europe", "Monde"];

interface CommercialForm {
  target_countries: string[];
  target_customer_types: string[];
  default_mov: number;
  default_mov_currency: string;
  default_delivery_days: number;
  shipping_zones: string[];
  shipping_from_country: string;
  return_policy: string;
  warranty_info: string;
  payment_terms_note: string;
  is_dropshipping: boolean;
}

const DEFAULT_FORM: CommercialForm = {
  target_countries: ["BE"],
  target_customer_types: [],
  default_mov: 0,
  default_mov_currency: "EUR",
  default_delivery_days: 3,
  shipping_zones: ["Benelux"],
  shipping_from_country: "BE",
  return_policy: "",
  warranty_info: "",
  payment_terms_note: "",
  is_dropshipping: false,
};

export default function VendorCommercialSettings({
  vendorId,
  compact = false,
  onSaved,
}: {
  vendorId: string;
  compact?: boolean;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CommercialForm>(DEFAULT_FORM);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["vendor-commercial-settings", vendorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_commercial_settings" as any)
        .select("*")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!vendorId,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        target_countries: settings.target_countries || ["BE"],
        target_customer_types: settings.target_customer_types || [],
        default_mov: settings.default_mov || 0,
        default_mov_currency: settings.default_mov_currency || "EUR",
        default_delivery_days: settings.default_delivery_days || 3,
        shipping_zones: settings.shipping_zones || ["Benelux"],
        shipping_from_country: settings.shipping_from_country || "BE",
        return_policy: settings.return_policy || "",
        warranty_info: settings.warranty_info || "",
        payment_terms_note: settings.payment_terms_note || "",
        is_dropshipping: settings.is_dropshipping || false,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { vendor_id: vendorId, ...form };
      if (settings?.id) {
        const { error } = await supabase
          .from("vendor_commercial_settings" as any)
          .update(form as any)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vendor_commercial_settings" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Paramètres commerciaux enregistrés");
      qc.invalidateQueries({ queryKey: ["vendor-commercial-settings", vendorId] });
      onSaved?.();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1B5BDA" }} />
      </div>
    );
  }

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className={compact ? "space-y-3" : "p-5 rounded-xl space-y-3"} style={compact ? {} : { backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
      <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "#1D2530" }}>
        <Icon size={15} style={{ color: "#1B5BDA" }} /> {title}
      </h3>
      {children}
    </div>
  );

  const CheckboxGrid = ({
    items,
    selected,
    onChange,
  }: {
    items: { key: string; label: string }[];
    selected: string[];
    onChange: (val: string[]) => void;
  }) => (
    <div className="flex flex-wrap gap-2">
      {items.map(item => {
        const active = selected.includes(item.key);
        return (
          <button key={item.key} type="button"
            onClick={() => onChange(toggleArray(selected, item.key))}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: active ? "#EEF2FF" : "#F8FAFC",
              color: active ? "#1B5BDA" : "#616B7C",
              border: `1px solid ${active ? "#BFDBFE" : "#E2E8F0"}`,
            }}>
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <Section title="Pays de vente" icon={Globe}>
        <p className="text-[11px]" style={{ color: "#8B95A5" }}>Dans quels pays souhaitez-vous vendre ?</p>
        <CheckboxGrid
          items={COUNTRIES.map(c => ({ key: c.code, label: c.label }))}
          selected={form.target_countries}
          onChange={val => setForm(f => ({ ...f, target_countries: val }))}
        />
      </Section>

      <Section title="Clients cibles" icon={Package}>
        <p className="text-[11px]" style={{ color: "#8B95A5" }}>À quels types de professionnels vendez-vous ?</p>
        <CheckboxGrid
          items={CUSTOMER_TYPES}
          selected={form.target_customer_types}
          onChange={val => setForm(f => ({ ...f, target_customer_types: val }))}
        />
      </Section>

      <Section title="Expédition & Livraison" icon={Truck}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>MOV par défaut (€)</label>
            <input type="number" min={0} step={1}
              className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none"
              style={{ borderColor: "#E2E8F0" }}
              value={form.default_mov}
              onChange={e => setForm(f => ({ ...f, default_mov: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Délai de livraison standard (jours)</label>
            <input type="number" min={1}
              className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none"
              style={{ borderColor: "#E2E8F0" }}
              value={form.default_delivery_days}
              onChange={e => setForm(f => ({ ...f, default_delivery_days: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Pays d'expédition</label>
          <select
            className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none"
            style={{ borderColor: "#E2E8F0" }}
            value={form.shipping_from_country}
            onChange={e => setForm(f => ({ ...f, shipping_from_country: e.target.value }))}
          >
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Zones d'expédition</label>
          <CheckboxGrid
            items={SHIPPING_ZONES.map(z => ({ key: z, label: z }))}
            selected={form.shipping_zones}
            onChange={val => setForm(f => ({ ...f, shipping_zones: val }))}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input type="checkbox" checked={form.is_dropshipping}
            onChange={e => setForm(f => ({ ...f, is_dropshipping: e.target.checked }))} />
          <span className="text-[12px]" style={{ color: "#616B7C" }}>Expédition directe au client final (dropshipping)</span>
        </label>
      </Section>

      <Section title="Conditions commerciales" icon={ShieldCheck}>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Politique de retour</label>
          <textarea rows={2}
            className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none resize-none"
            style={{ borderColor: "#E2E8F0" }}
            value={form.return_policy}
            onChange={e => setForm(f => ({ ...f, return_policy: e.target.value }))}
            placeholder="Ex: Retour accepté sous 14 jours, produit non ouvert…"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Garantie</label>
          <textarea rows={2}
            className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none resize-none"
            style={{ borderColor: "#E2E8F0" }}
            value={form.warranty_info}
            onChange={e => setForm(f => ({ ...f, warranty_info: e.target.value }))}
            placeholder="Ex: Garantie fabricant 2 ans…"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Conditions de paiement spécifiques</label>
          <input
            className="w-full px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none"
            style={{ borderColor: "#E2E8F0" }}
            value={form.payment_terms_note}
            onChange={e => setForm(f => ({ ...f, payment_terms_note: e.target.value }))}
            placeholder="Ex: Paiement comptant uniquement"
          />
        </div>
      </Section>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "#1B5BDA" }}
      >
        {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer les paramètres commerciaux
      </button>
    </div>
  );
}
