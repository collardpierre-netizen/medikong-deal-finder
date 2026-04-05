import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import VendorCommissionTab from "@/components/vendor/VendorCommissionTab";
import VendorCommercialSettings from "@/components/vendor/VendorCommercialSettings";
import { Check, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const useCurrentVendor = () =>
  useQuery({
    queryKey: ["current-vendor"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export default function VendorSettings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const { data: vendor, isLoading } = useCurrentVendor();
  const qc = useQueryClient();

  // Form state
  const [form, setForm] = useState({
    company_name: "", name: "", email: "", phone: "",
    vat_number: "", address_line1: "", city: "", postal_code: "",
    country_code: "BE", description: "",
  });

  useEffect(() => {
    if (vendor) {
      setForm({
        company_name: vendor.company_name || "",
        name: vendor.name || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        vat_number: vendor.vat_number || "",
        address_line1: vendor.address_line1 || "",
        city: vendor.city || "",
        postal_code: vendor.postal_code || "",
        country_code: vendor.country_code || "BE",
        description: vendor.description || "",
      });
    }
  }, [vendor]);

  const updateVendor = useMutation({
    mutationFn: async (updates: typeof form) => {
      if (!vendor) throw new Error("No vendor");
      const { error } = await supabase
        .from("vendors")
        .update(updates)
        .eq("id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["current-vendor"] });
      setEditing(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const tabs = [
    { id: "profile", label: "Profil entreprise" },
    { id: "commission", label: "Commission" },
  ];

  const countryLabels: Record<string, string> = { BE: "Belgique", FR: "France", NL: "Pays-Bas", LU: "Luxembourg", DE: "Allemagne" };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#1B5BDA]" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-[#1D2530]">Paramètres</h1>
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Profil vendeur non trouvé</h3>
            <p className="text-[13px] text-[#8B95A5] max-w-md">
              Votre compte n'est pas encore lié à un profil vendeur. Contactez l'équipe MediKong pour finaliser votre inscription.
            </p>
          </div>
        </VCard>
      </div>
    );
  }

  const infoRows = [
    ["Raison sociale", form.company_name || "—"],
    ["Nom commercial", form.name || "—"],
    ["Email", form.email || "—"],
    ["Téléphone", form.phone || "—"],
    ["N° TVA", form.vat_number || "—"],
    ["Adresse", form.address_line1 || "—"],
    ["Ville", form.city || "—"],
    ["Code postal", form.postal_code || "—"],
    ["Pays", countryLabels[form.country_code] || form.country_code],
    ["Commission", `${vendor.commission_rate}%`],
    ["Statut", vendor.is_active ? "Actif" : "En attente d'activation"],
    ["Membre depuis", new Date(vendor.created_at).toLocaleDateString("fr-BE", { month: "long", year: "numeric" })],
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1D2530]">Paramètres</h1>
      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1D2530]">Informations entreprise</h3>
              {!editing ? (
                <VBtn small icon="Pencil" onClick={() => setEditing(true)}>Modifier</VBtn>
              ) : (
                <div className="flex gap-2">
                  <VBtn small onClick={() => { setEditing(false); if (vendor) setForm({ company_name: vendor.company_name || "", name: vendor.name || "", email: vendor.email || "", phone: vendor.phone || "", vat_number: vendor.vat_number || "", address_line1: vendor.address_line1 || "", city: vendor.city || "", postal_code: vendor.postal_code || "", country_code: vendor.country_code || "BE", description: vendor.description || "" }); }}>Annuler</VBtn>
                  <VBtn small primary icon="Save" onClick={() => updateVendor.mutate(form)}>
                    {updateVendor.isPending ? "..." : "Sauvegarder"}
                  </VBtn>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="space-y-3 text-[13px]">
                {infoRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#8B95A5]">{k}</span>
                    <span className="font-medium text-[#1D2530]">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Raison sociale", key: "company_name" },
                  { label: "Nom commercial", key: "name" },
                  { label: "Email", key: "email" },
                  { label: "Téléphone", key: "phone" },
                  { label: "N° TVA", key: "vat_number" },
                  { label: "Adresse", key: "address_line1" },
                  { label: "Ville", key: "city" },
                  { label: "Code postal", key: "postal_code" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] text-[#8B95A5] block mb-1">{f.label}</label>
                    <input
                      className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                      value={(form as any)[f.key] || ""}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] text-[#8B95A5] block mb-1">Pays</label>
                  <select
                    className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                    value={form.country_code}
                    onChange={e => setForm(prev => ({ ...prev, country_code: e.target.value }))}
                  >
                    {Object.entries(countryLabels).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#8B95A5] block mb-1">Description</label>
                  <textarea
                    className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none resize-none"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Statut du compte</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: vendor.is_active ? "#F0FDF4" : "#FEF3C7" }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${vendor.is_active ? "bg-[#059669]" : "bg-[#F59E0B]"}`}>
                  <Check size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#1D2530]">{vendor.is_active ? "Compte actif" : "En attente d'activation"}</p>
                  <p className="text-[11px] text-[#616B7C]">{vendor.is_active ? "Vous pouvez créer des offres" : "Un administrateur doit activer votre compte"}</p>
                </div>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">Vérifié</span>
                  <VBadge color={vendor.is_verified ? "#059669" : "#F59E0B"}>{vendor.is_verified ? "Oui" : "Non"}</VBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">Gestion offres</span>
                  <VBadge color={vendor.can_manage_offers ? "#059669" : "#8B95A5"}>{vendor.can_manage_offers ? "Activée" : "Désactivée"}</VBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A5]">Ventes totales</span>
                  <span className="font-medium text-[#1D2530]">{vendor.total_sales}</span>
                </div>
              </div>
            </div>
          </VCard>
        </div>
      )}

      {activeTab === "commission" && <VendorCommissionTab />}
    </div>
  );
}
