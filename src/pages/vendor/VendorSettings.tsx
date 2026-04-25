import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import VendorShippingSettings from "@/components/vendor/VendorShippingSettings";
import VendorBrandingTab from "@/components/vendor/VendorBrandingTab";
import VendorTeamTab from "@/components/vendor/VendorTeamTab";
import {
  Check, Save, Loader2, Plus, Trash2, Star, MapPin, Bell, BellOff,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";

export default function VendorSettings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const { data: vendor, isLoading } = useCurrentVendor();
  const qc = useQueryClient();
  const vendorId = vendor?.id;
  const shippingMode = (vendor as any)?.vendor_shipping_mode ?? "no_shipping";

  // Profile form
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
      const { error } = await supabase.from("vendors").update(updates).eq("id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profil mis à jour"); qc.invalidateQueries({ queryKey: ["current-vendor"] }); setEditing(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const tabs = [
    { id: "profile", label: "Profil" },
    { id: "branding", label: "Branding" },
    { id: "team", label: "Équipe" },
    { id: "addresses", label: "Adresses" },
    { id: "shipping_mode", label: "Mode expédition" },
    { id: "notifications", label: "Notifications" },
  ];

  const countryLabels: Record<string, string> = { BE: "Belgique", FR: "France", NL: "Pays-Bas", LU: "Luxembourg", DE: "Allemagne" };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#1B5BDA]" /></div>;
  }
  if (!vendor) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-[#1D2530]">Paramètres</h1>
        <VCard><div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Profil vendeur non trouvé</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">Contactez l'équipe MediKong pour finaliser votre inscription.</p>
        </div></VCard>
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
    ["Statut", vendor.is_active ? "Actif" : "En attente"],
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
                  <VBtn small primary icon="Save" onClick={() => updateVendor.mutate(form)}>{updateVendor.isPending ? "..." : "Sauvegarder"}</VBtn>
                </div>
              )}
            </div>
            {!editing ? (
              <div className="space-y-3 text-[13px]">
                {infoRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-[#8B95A5]">{k}</span><span className="font-medium text-[#1D2530]">{v}</span></div>
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
                    <input className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none" value={(form as any)[f.key] || ""} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] text-[#8B95A5] block mb-1">Pays</label>
                  <select className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none" value={form.country_code} onChange={e => setForm(prev => ({ ...prev, country_code: e.target.value }))}>
                    {Object.entries(countryLabels).map(([code, label]) => (<option key={code} value={code}>{label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#8B95A5] block mb-1">Description</label>
                  <textarea className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none resize-none" rows={3} value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
                </div>
              </div>
            )}
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Statut du compte</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: vendor.is_active ? "#F0FDF4" : "#FEF3C7" }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${vendor.is_active ? "bg-[#059669]" : "bg-[#F59E0B]"}`}><Check size={16} className="text-white" /></div>
                <div>
                  <p className="text-[13px] font-semibold text-[#1D2530]">{vendor.is_active ? "Compte actif" : "En attente d'activation"}</p>
                  <p className="text-[11px] text-[#616B7C]">{vendor.is_active ? "Vous pouvez créer des offres" : "Un administrateur doit activer votre compte"}</p>
                </div>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-[#8B95A5]">Vérifié</span><VBadge color={vendor.is_verified ? "#059669" : "#F59E0B"}>{vendor.is_verified ? "Oui" : "Non"}</VBadge></div>
                <div className="flex justify-between"><span className="text-[#8B95A5]">Gestion offres</span><VBadge color={vendor.can_manage_offers ? "#059669" : "#8B95A5"}>{vendor.can_manage_offers ? "Activée" : "Désactivée"}</VBadge></div>
                <div className="flex justify-between"><span className="text-[#8B95A5]">Ventes totales</span><span className="font-medium text-[#1D2530]">{vendor.total_sales}</span></div>
              </div>
            </div>
          </VCard>
        </div>
      )}

      {activeTab === "branding" && vendor && (
        <VendorBrandingTab vendor={vendor} />
      )}

      {activeTab === "addresses" && vendorId && (
        <AddressesTab vendorId={vendorId} shippingMode={shippingMode} vendor={vendor} />
      )}

      {activeTab === "shipping_mode" && vendor && (
        <VendorShippingSettings
          vendorId={vendor.id}
          currentMode={shippingMode}
          marginPercentage={(vendor as any).shipping_margin_percentage || 15}
        />
      )}

      {activeTab === "notifications" && vendorId && (
        <NotificationsTab vendorId={vendorId} />
      )}
    </div>
  );
}

/* ─── Addresses Tab ─── */
function AddressesTab({ vendorId, shippingMode, vendor }: { vendorId: string; shippingMode: string; vendor?: any }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ label: "Principal", address_line1: "", house_number: "", postal_code: "", city: "", country: "BE", phone: "", is_default: false });
  const [seedAttempted, setSeedAttempted] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["vendor-addresses", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_addresses").select("*").eq("vendor_id", vendorId).order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-seed: si aucune adresse mais le vendor a une adresse encodée à l'inscription, on l'insère comme adresse principale.
  useEffect(() => {
    if (isLoading || seedAttempted) return;
    if (addresses.length > 0) return;
    if (!vendor?.address_line1 || !vendor?.city || !vendor?.postal_code) return;
    setSeedAttempted(true);
    (async () => {
      const payload = {
        vendor_id: vendorId,
        label: "Principal",
        address_line1: vendor.address_line1,
        house_number: vendor.address_line2 || "",
        postal_code: vendor.postal_code,
        city: vendor.city,
        country: vendor.country_code || "BE",
        phone: vendor.phone || "",
        is_default: true,
      };
      const { error } = await supabase.from("vendor_addresses").insert(payload as any);
      if (!error) {
        qc.invalidateQueries({ queryKey: ["vendor-addresses", vendorId] });
      }
    })();
  }, [isLoading, addresses.length, vendor, vendorId, seedAttempted, qc]);

  const upsertAddr = useMutation({
    mutationFn: async () => {
      const payload = { ...addrForm, vendor_id: vendorId };
      if (addrForm.is_default) {
        // Unset other defaults
        await supabase.from("vendor_addresses").update({ is_default: false } as any).eq("vendor_id", vendorId);
      }
      if (editingId) {
        const { error } = await supabase.from("vendor_addresses").update(payload as any).eq("id", editingId);
        if (error) throw error;
        // If whitelabel + default, sync Sendcloud
        if (shippingMode === "medikong_whitelabel" && addrForm.is_default) {
          await supabase.functions.invoke("sendcloud-api", {
            body: { action: "update_sender_address", vendor_id: vendorId, address: payload },
          });
        }
      } else {
        const { error } = await supabase.from("vendor_addresses").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Adresse mise à jour" : "Adresse ajoutée");
      qc.invalidateQueries({ queryKey: ["vendor-addresses", vendorId] });
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteAddr = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Adresse supprimée"); qc.invalidateQueries({ queryKey: ["vendor-addresses", vendorId] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("vendor_addresses").update({ is_default: false } as any).eq("vendor_id", vendorId);
      const { error } = await supabase.from("vendor_addresses").update({ is_default: true } as any).eq("id", id);
      if (error) throw error;
      if (shippingMode === "medikong_whitelabel") {
        const addr = addresses.find(a => a.id === id);
        if (addr) {
          await supabase.functions.invoke("sendcloud-api", {
            body: { action: "update_sender_address", vendor_id: vendorId, address: addr },
          });
        }
      }
    },
    onSuccess: () => { toast.success("Adresse par défaut mise à jour"); qc.invalidateQueries({ queryKey: ["vendor-addresses", vendorId] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => { setEditingId(null); setAddrForm({ label: "Principal", address_line1: "", house_number: "", postal_code: "", city: "", country: "BE", phone: "", is_default: addresses.length === 0 }); setDialogOpen(true); };
  const openEdit = (a: any) => { setEditingId(a.id); setAddrForm({ label: a.label, address_line1: a.address_line1, house_number: a.house_number || "", postal_code: a.postal_code, city: a.city, country: a.country, phone: a.phone || "", is_default: a.is_default }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const countryLabels: Record<string, string> = { BE: "Belgique", FR: "France", NL: "Pays-Bas", LU: "Luxembourg", DE: "Allemagne" };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#8B95A5]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-[#1D2530]">Adresses d'expédition</h2>
          <p className="text-[12px] text-[#8B95A5] mt-0.5">Gérez vos adresses d'expédition. L'adresse par défaut est utilisée pour les nouvelles expéditions.</p>
        </div>
        <VBtn primary small onClick={openNew}><Plus size={14} className="mr-1" />Ajouter</VBtn>
      </div>

      {addresses.length === 0 ? (
        <VCard>
          <div className="text-center py-12">
            <MapPin size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[13px] text-[#8B95A5]">Aucune adresse enregistrée</p>
          </div>
        </VCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((a: any) => (
            <VCard key={a.id} className={a.is_default ? "border-[#1B5BDA] border-2" : ""}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#1B5BDA]" />
                  <span className="text-[13px] font-bold text-[#1D2530]">{a.label}</span>
                  {a.is_default && <VBadge color="#1B5BDA">Par défaut</VBadge>}
                </div>
                <div className="flex gap-1">
                  {!a.is_default && (
                    <button onClick={() => setDefault.mutate(a.id)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#F59E0B]" title="Définir par défaut"><Star size={14} /></button>
                  )}
                  <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#1B5BDA]" title="Modifier"><Save size={14} /></button>
                  <button onClick={() => deleteAddr.mutate(a.id)} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#8B95A5] hover:text-[#EF4343]" title="Supprimer"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="text-[12px] text-[#616B7C] space-y-0.5">
                <p>{a.address_line1}{a.house_number ? ` ${a.house_number}` : ""}</p>
                <p>{a.postal_code} {a.city}, {countryLabels[a.country] || a.country}</p>
                {a.phone && <p>📞 {a.phone}</p>}
              </div>
              {shippingMode === "medikong_whitelabel" && a.sendcloud_sender_address_id && (
                <p className="text-[10px] text-[#8B95A5] mt-2 font-mono">Sendcloud ID: {a.sendcloud_sender_address_id}</p>
              )}
            </VCard>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier l'adresse" : "Nouvelle adresse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {[
              { label: "Libellé", key: "label", placeholder: "Ex: Entrepôt principal" },
              { label: "Rue", key: "address_line1", placeholder: "Rue de la Procession" },
              { label: "N°", key: "house_number", placeholder: "23" },
              { label: "Code postal", key: "postal_code", placeholder: "7822" },
              { label: "Ville", key: "city", placeholder: "Ath" },
              { label: "Téléphone", key: "phone", placeholder: "+32..." },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[11px] text-[#8B95A5] block mb-1">{f.label}</label>
                <input
                  className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                  value={(addrForm as any)[f.key]}
                  onChange={e => setAddrForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">Pays</label>
              <select className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none" value={addrForm.country} onChange={e => setAddrForm(prev => ({ ...prev, country: e.target.value }))}>
                {Object.entries(countryLabels).map(([code, label]) => (<option key={code} value={code}>{label}</option>))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[#1D2530] cursor-pointer">
              <input type="checkbox" checked={addrForm.is_default} onChange={e => setAddrForm(prev => ({ ...prev, is_default: e.target.checked }))} className="rounded border-[#CBD5E1]" />
              Définir comme adresse par défaut
            </label>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <VBtn small onClick={closeDialog}>Annuler</VBtn>
            <VBtn small primary onClick={() => upsertAddr.mutate()} disabled={upsertAddr.isPending || !addrForm.address_line1 || !addrForm.postal_code || !addrForm.city}>
              {upsertAddr.isPending ? <Loader2 size={14} className="animate-spin" /> : (editingId ? "Sauvegarder" : "Ajouter")}
            </VBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Notifications Tab ─── */
function NotificationsTab({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["vendor-notif-settings", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_notification_settings").select("*").eq("vendor_id", vendorId).maybeSingle();
      if (error) throw error;
      if (!data) {
        // Create default
        const { data: created, error: insErr } = await supabase.from("vendor_notification_settings").insert({ vendor_id: vendorId } as any).select().single();
        if (insErr) throw insErr;
        return created;
      }
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase.from("vendor_notification_settings").update({ [key]: value } as any).eq("vendor_id", vendorId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-notif-settings", vendorId] }),
    onError: (err: any) => toast.error(err.message),
  });

  const NOTIF_OPTIONS = [
    { key: "notify_shipment_created", label: "Expédition créée", description: "Recevoir un email lorsqu'une expédition est créée pour une commande." },
    { key: "notify_shipment_delivered", label: "Livraison confirmée", description: "Recevoir un email lorsqu'un colis est livré au destinataire." },
    { key: "notify_shipment_exception", label: "Incident de livraison", description: "Recevoir un email en cas de problème de livraison (retour, échec, etc.)." },
    { key: "notify_invoice_ready", label: "Facture disponible", description: "Recevoir un email lorsqu'une nouvelle facture mensuelle est prête." },
  ];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#8B95A5]" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-bold text-[#1D2530]">Notifications par email</h2>
        <p className="text-[12px] text-[#8B95A5] mt-0.5">Choisissez quelles notifications vous souhaitez recevoir par email.</p>
      </div>
      <VCard>
        <div className="divide-y divide-[#F1F5F9]">
          {NOTIF_OPTIONS.map((opt) => {
            const enabled = settings ? (settings as any)[opt.key] ?? true : true;
            return (
              <div key={opt.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  {enabled ? <Bell size={16} className="text-[#1B5BDA] mt-0.5" /> : <BellOff size={16} className="text-[#CBD5E1] mt-0.5" />}
                  <div>
                    <p className="text-[13px] font-medium text-[#1D2530]">{opt.label}</p>
                    <p className="text-[12px] text-[#8B95A5]">{opt.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(val) => toggleMutation.mutate({ key: opt.key, value: val })}
                />
              </div>
            );
          })}
        </div>
      </VCard>
    </div>
  );
}
