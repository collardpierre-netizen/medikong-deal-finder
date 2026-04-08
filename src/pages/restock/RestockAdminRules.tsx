import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Shield } from "lucide-react";
import { toast } from "sonner";

export default function RestockAdminRules() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["restock-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restock_rules").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("restock_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-rules"] });
      toast.success("Règle mise à jour");
    },
  });

  const updateValue = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("restock_rules").update({ value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-rules"] });
      toast.success("Valeur enregistrée");
    },
  });

  const ruleLabels: Record<string, { label: string; description: string; unit: string }> = {
    min_dlu_months: { label: "DLU minimum", description: "Nombre de mois minimum avant la date de péremption", unit: "mois" },
    max_unit_price: { label: "Prix maximum par unité", description: "Prix HT maximum autorisé par unité", unit: "€" },
    commission_pct: { label: "Commission sur ventes", description: "Pourcentage de commission prélevé sur chaque vente", unit: "%" },
    shipping_flat_fee: { label: "Forfait livraison", description: "Montant forfaitaire pour la livraison MediKong", unit: "€" },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#EBF0FB]">
          <Shield size={22} className="text-[#1C58D9]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1E252F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Règles de filtrage
          </h1>
          <p className="text-sm text-[#5C6470]">Configuration des règles automatiques de modération des offres</p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-[#8B929C]">Chargement…</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 text-[#8B929C]">Aucune règle configurée</div>
        ) : (
          rules.map((rule: any) => {
            const meta = ruleLabels[rule.rule_type] || { label: rule.rule_type, description: "", unit: "" };
            return (
              <div key={rule.id} className="bg-white rounded-xl border border-[#D0D5DC] p-5 shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-[#1E252F]">{meta.label}</h3>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                      />
                    </div>
                    <p className="text-sm text-[#5C6470]">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      defaultValue={rule.value}
                      className="w-24 rounded-lg border-[#D0D5DC] text-right"
                      onBlur={(e) => {
                        if (e.target.value !== rule.value) {
                          updateValue.mutate({ id: rule.id, value: e.target.value });
                        }
                      }}
                    />
                    <span className="text-sm text-[#5C6470] min-w-[30px]">{meta.unit}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
