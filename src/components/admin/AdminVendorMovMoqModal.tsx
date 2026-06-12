import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import VendorCommercialSettings from "@/components/vendor/VendorCommercialSettings";
import VendorProfileDefaults from "@/components/vendor/VendorProfileDefaults";

interface OfferRow {
  id: string;
  product_id: string;
  moq: number | null;
  mov: number | null;
  price_excl_vat: number | null;
  is_active: boolean;
  products?: { name: string | null; gtin?: string | null } | null;
}

function OffersMovMoqTable({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { moq?: string; mov?: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["admin-vendor-offers-mov-moq", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, product_id, moq, mov, price_excl_vat, is_active, products:product_id(name, gtin)")
        .eq("vendor_id", vendorId)
        .order("is_active", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as OfferRow[];
    },
    enabled: !!vendorId,
  });

  const saveOffer = useMutation({
    mutationFn: async ({ id, moq, mov }: { id: string; moq: number | null; mov: number | null }) => {
      const { error } = await supabase.from("offers").update({ moq, mov } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Offre mise à jour");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["admin-vendor-offers-mov-moq", vendorId] });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSavingId(null),
  });

  const filtered = offers.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.products?.name?.toLowerCase().includes(q) ||
      o.products?.gtin?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-[#1B5BDA]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Filtrer par produit, GTIN, ID offre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-[13px] rounded-lg border focus:border-[#1B5BDA] focus:outline-none"
          style={{ borderColor: "#E2E8F0" }}
        />
        <span className="text-[12px] text-[#8B95A5]">{filtered.length} offre(s)</span>
      </div>

      <div className="overflow-x-auto rounded-xl border max-h-[420px] overflow-y-auto" style={{ borderColor: "#E2E8F0" }}>
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[#F8FAFC] z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5]">Produit</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5]">Prix HTVA</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5] w-24">MOQ</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5] w-28">MOV (€)</th>
              <th className="text-left px-3 py-2 font-semibold text-[#8B95A5]">Statut</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const edit = edits[o.id] || {};
              const moqVal = edit.moq ?? (o.moq ?? "").toString();
              const movVal = edit.mov ?? (o.mov ?? "").toString();
              const dirty = edit.moq !== undefined || edit.mov !== undefined;
              return (
                <tr key={o.id} className="border-t" style={{ borderColor: "#E2E8F0" }}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#1D2530] truncate max-w-[280px]" title={o.products?.name || ""}>
                      {o.products?.name || "—"}
                    </div>
                    {o.products?.gtin && <div className="text-[10px] text-[#8B95A5]">GTIN {o.products.gtin}</div>}
                  </td>
                  <td className="px-3 py-2 text-[#616B7C]">
                    {o.price_excl_vat != null ? `${Number(o.price_excl_vat).toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className="w-20 px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={moqVal}
                      onChange={(e) => setEdits((p) => ({ ...p, [o.id]: { ...p[o.id], moq: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-24 px-2 py-1.5 rounded-lg text-[12px] border focus:border-[#1B5BDA] focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                      value={movVal}
                      onChange={(e) => setEdits((p) => ({ ...p, [o.id]: { ...p[o.id], mov: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={
                        o.is_active
                          ? { backgroundColor: "#F0FDF4", color: "#059669" }
                          : { backgroundColor: "#F1F5F9", color: "#8B95A5" }
                      }
                    >
                      {o.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={!dirty || savingId === o.id}
                      onClick={() => {
                        const moqNum = edit.moq !== undefined ? (edit.moq === "" ? 1 : Math.max(1, Number(edit.moq))) : (o.moq ?? 1);
                        const movRaw = edit.mov !== undefined ? edit.mov : (o.mov?.toString() ?? "");
                        const movNum = movRaw === "" ? null : Math.max(0, Number(movRaw));
                        if (edit.moq !== undefined && !Number.isFinite(moqNum)) {
                          toast.error("MOQ invalide");
                          return;
                        }
                        if (movNum !== null && !Number.isFinite(movNum)) {
                          toast.error("MOV invalide");
                          return;
                        }
                        setSavingId(o.id);
                        saveOffer.mutate({ id: o.id, moq: moqNum, mov: movNum });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white disabled:opacity-40"
                      style={{ backgroundColor: "#1B5BDA" }}
                    >
                      {savingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      OK
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-[#8B95A5]">
                  Aucune offre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#8B95A5]">
        MOQ = quantité minimale par commande. MOV = montant minimum HTVA pour atteindre le seuil de cette offre (fallback global {`>`} 500 € si vide).
      </p>
    </div>
  );
}

export default function AdminVendorMovMoqModal({
  vendorId,
  vendorName,
  open,
  onOpenChange,
}: {
  vendorId: string | null;
  vendorName?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!vendorId) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MOV / MOQ — {vendorName || "Vendeur"}</DialogTitle>
          <DialogDescription>
            Édition admin des seuils MOV (montant minimum de commande) et MOQ (quantité minimale) pour ce vendeur,
            par profil acheteur, et par offre.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profiles" className="mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="profiles">Par client / profil</TabsTrigger>
            <TabsTrigger value="vendor">MOV global du vendeur</TabsTrigger>
            <TabsTrigger value="offers">Par offre</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="pt-4">
            <VendorProfileDefaults vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="vendor" className="pt-4">
            <VendorCommercialSettings vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="offers" className="pt-4">
            <OffersMovMoqTable vendorId={vendorId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
