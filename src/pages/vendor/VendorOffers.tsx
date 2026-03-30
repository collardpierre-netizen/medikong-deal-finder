import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";
import { Tag, Plus, Pencil, Trash2, X, Save, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

const useCurrentVendor = () =>
  useQuery({
    queryKey: ["current-vendor"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("vendors").select("*").eq("auth_user_id", user.id).maybeSingle();
      return data;
    },
  });

const useVendorOffers = (vendorId: string | undefined) =>
  useQuery({
    queryKey: ["vendor-offers", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from("offers")
        .select("*, products(name, gtin, image_urls, slug)")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

const useProducts = () =>
  useQuery({
    queryKey: ["all-products-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, gtin, slug")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

interface OfferForm {
  product_id: string;
  price_excl_vat: string;
  vat_rate: string;
  stock_quantity: string;
  moq: string;
  delivery_days: string;
  country_code: string;
}

const emptyForm: OfferForm = {
  product_id: "", price_excl_vat: "", vat_rate: "21", stock_quantity: "", moq: "1", delivery_days: "3", country_code: "BE",
};

export default function VendorOffers() {
  const { data: vendor } = useCurrentVendor();
  const { data: offers = [], isLoading } = useVendorOffers(vendor?.id);
  const { data: products = [] } = useProducts();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [search, setSearch] = useState("");

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (offer: any) => {
    setForm({
      product_id: offer.product_id,
      price_excl_vat: String(offer.price_excl_vat),
      vat_rate: String(offer.vat_rate),
      stock_quantity: String(offer.stock_quantity),
      moq: String(offer.moq),
      delivery_days: String(offer.delivery_days),
      country_code: offer.country_code || "BE",
    });
    setEditingId(offer.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const saveOffer = useMutation({
    mutationFn: async () => {
      if (!vendor) throw new Error("No vendor");
      const priceExcl = parseFloat(form.price_excl_vat);
      const vatRate = parseFloat(form.vat_rate);
      if (!form.product_id || isNaN(priceExcl) || priceExcl <= 0) throw new Error("Champs requis manquants");

      const priceIncl = Math.round(priceExcl * (1 + vatRate / 100) * 100) / 100;
      const payload = {
        vendor_id: vendor.id,
        product_id: form.product_id,
        price_excl_vat: priceExcl,
        price_incl_vat: priceIncl,
        vat_rate: vatRate,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        moq: parseInt(form.moq) || 1,
        delivery_days: parseInt(form.delivery_days) || 3,
        country_code: form.country_code,
        stock_status: parseInt(form.stock_quantity) > 0 ? "in_stock" as const : "out_of_stock" as const,
        is_active: true,
      };

      if (editingId) {
        const { error } = await supabase.from("offers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("offers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Offre modifiée" : "Offre créée");
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      closeForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOffer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offre supprimée");
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filteredOffers = search
    ? offers.filter((o: any) => {
        const pName = (o.products as any)?.name || "";
        return pName.toLowerCase().includes(search.toLowerCase());
      })
    : offers;

  if (!vendor) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-[#1D2530]">Mes Offres</h1>
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Tag size={48} className="text-[#CBD5E1] mb-4" />
            <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Profil vendeur non trouvé</h3>
            <p className="text-[13px] text-[#8B95A5]">Connectez-vous avec votre compte vendeur.</p>
          </div>
        </VCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">Mes Offres</h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">{offers.length} offre{offers.length !== 1 ? "s" : ""} au total</p>
        </div>
        <VBtn primary icon="Plus" onClick={openCreate}>Nouvelle offre</VBtn>
      </div>

      {/* Search */}
      {offers.length > 0 && (
        <input
          className="w-full max-w-sm px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <VCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1D2530]">{editingId ? "Modifier l'offre" : "Nouvelle offre"}</h3>
            <button onClick={closeForm} className="p-1 hover:bg-[#F1F5F9] rounded"><X size={16} className="text-[#8B95A5]" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[11px] text-[#8B95A5] block mb-1">Produit *</label>
              <select
                className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.product_id}
                onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}
              >
                <option value="">Sélectionnez un produit</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} {p.gtin ? `(${p.gtin})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">Prix HT (€) *</label>
              <input type="number" step="0.01" min="0" className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.price_excl_vat} onChange={e => setForm(p => ({ ...p, price_excl_vat: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">TVA (%)</label>
              <select className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.vat_rate} onChange={e => setForm(p => ({ ...p, vat_rate: e.target.value }))}>
                <option value="21">21%</option>
                <option value="6">6%</option>
                <option value="0">0%</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">Stock</label>
              <input type="number" min="0" className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">MOQ (min.)</label>
              <input type="number" min="1" className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.moq} onChange={e => setForm(p => ({ ...p, moq: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">Délai livraison (jours)</label>
              <input type="number" min="1" className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.delivery_days} onChange={e => setForm(p => ({ ...p, delivery_days: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] text-[#8B95A5] block mb-1">Pays</label>
              <select className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg focus:border-[#1B5BDA] focus:outline-none"
                value={form.country_code} onChange={e => setForm(p => ({ ...p, country_code: e.target.value }))}>
                <option value="BE">Belgique</option>
                <option value="FR">France</option>
                <option value="NL">Pays-Bas</option>
                <option value="LU">Luxembourg</option>
                <option value="DE">Allemagne</option>
              </select>
            </div>
          </div>
          {form.price_excl_vat && (
            <div className="mt-3 p-3 bg-[#F8FAFC] rounded-lg text-[12px] text-[#616B7C]">
              Prix TTC : <strong className="text-[#1D2530]">{(parseFloat(form.price_excl_vat) * (1 + parseFloat(form.vat_rate) / 100)).toFixed(2)} €</strong>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <VBtn small onClick={closeForm}>Annuler</VBtn>
            <VBtn small primary onClick={() => saveOffer.mutate()}>
              {saveOffer.isPending ? <Loader2 size={14} className="animate-spin" /> : editingId ? "Modifier" : "Créer l'offre"}
            </VBtn>
          </div>
        </VCard>
      )}

      {/* Offers list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#1B5BDA]" /></div>
      ) : filteredOffers.length === 0 ? (
        <VCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={48} className="text-[#CBD5E1] mb-4" />
            <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucune offre</h3>
            <p className="text-[13px] text-[#8B95A5] max-w-md mb-4">
              {search ? "Aucune offre ne correspond à votre recherche." : "Créez votre première offre pour commencer à vendre sur MediKong."}
            </p>
            {!search && <VBtn primary icon="Plus" onClick={openCreate}>Créer une offre</VBtn>}
          </div>
        </VCard>
      ) : (
        <VCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2.5 px-3 font-medium">Produit</th>
                  <th className="text-right py-2.5 px-3 font-medium">Prix HT</th>
                  <th className="text-right py-2.5 px-3 font-medium">Prix TTC</th>
                  <th className="text-center py-2.5 px-3 font-medium">Stock</th>
                  <th className="text-center py-2.5 px-3 font-medium">MOQ</th>
                  <th className="text-center py-2.5 px-3 font-medium">Délai</th>
                  <th className="text-center py-2.5 px-3 font-medium">Pays</th>
                  <th className="text-center py-2.5 px-3 font-medium">Statut</th>
                  <th className="text-right py-2.5 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((offer: any) => {
                  const prod = offer.products as any;
                  return (
                    <tr key={offer.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {prod?.image_urls?.[0] ? (
                            <img src={prod.image_urls[0]} alt="" className="w-8 h-8 rounded object-contain bg-[#F8FAFC]" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-[#F1F5F9] flex items-center justify-center">
                              <Package size={14} className="text-[#CBD5E1]" />
                            </div>
                          )}
                          <span className="font-medium text-[#1D2530] line-clamp-1 max-w-[200px]">{prod?.name || "Produit inconnu"}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">{Number(offer.price_excl_vat).toFixed(2)} €</td>
                      <td className="py-2.5 px-3 text-right">{Number(offer.price_incl_vat).toFixed(2)} €</td>
                      <td className="py-2.5 px-3 text-center">{offer.stock_quantity}</td>
                      <td className="py-2.5 px-3 text-center">{offer.moq}</td>
                      <td className="py-2.5 px-3 text-center">{offer.delivery_days}j</td>
                      <td className="py-2.5 px-3 text-center">{offer.country_code}</td>
                      <td className="py-2.5 px-3 text-center">
                        <VBadge color={offer.is_active ? "#059669" : "#8B95A5"}>{offer.is_active ? "Active" : "Inactive"}</VBadge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(offer)} className="p-1.5 hover:bg-[#EFF6FF] rounded" title="Modifier">
                            <Pencil size={14} className="text-[#1B5BDA]" />
                          </button>
                          <button
                            onClick={() => { if (confirm("Supprimer cette offre ?")) deleteOffer.mutate(offer.id); }}
                            className="p-1.5 hover:bg-[#FEF2F2] rounded" title="Supprimer"
                          >
                            <Trash2 size={14} className="text-[#EF4343]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </VCard>
      )}
    </div>
  );
}
