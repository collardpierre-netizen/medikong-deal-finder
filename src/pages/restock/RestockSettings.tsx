import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface Setting {
  id: string;
  key: string;
  value: string;
  label: string | null;
  description: string | null;
}

export default function RestockSettings() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["restock-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restock_settings").select("*").order("key");
      if (error) throw error;
      return (data || []) as Setting[];
    },
  });

  useEffect(() => {
    if (settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach((s) => (map[s.key] = s.value));
      setValues(map);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const s of settings) {
        if (values[s.key] !== s.value) {
          await supabase
            .from("restock_settings")
            .update({ value: values[s.key], updated_at: new Date().toISOString() })
            .eq("key", s.key);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-settings"] });
      toast.success("Paramètres enregistrés");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const groups = [
    {
      title: "Commissions & marges",
      keys: ["commission_buyer_pct", "shipping_margin_pct", "shipping_base_rate_eur_per_kg", "shipping_minimum_fee_eur"],
    },
    {
      title: "Règles métier",
      keys: ["dlu_minimum_months", "exclusivity_days", "cancellation_penalty_eur", "escrow_release_days"],
    },
    {
      title: "Textes",
      keys: ["exclusivity_text"],
    },
  ];

  const isTextarea = (key: string) => key === "exclusivity_text";

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-[#1C58D9]" />
        <h1 className="text-2xl font-bold text-[#1E252F]">Paramètres ReStock</h1>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.title} className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[#1E252F] mb-4 uppercase tracking-wider">{group.title}</h2>
              <div className="space-y-4">
                {group.keys.map((key) => {
                  const setting = settings.find((s) => s.key === key);
                  if (!setting) return null;
                  return (
                    <div key={key}>
                      <label className="text-sm font-medium text-[#1E252F]">{setting.label || key}</label>
                      {setting.description && (
                        <p className="text-xs text-[#8B929C] mb-1">{setting.description}</p>
                      )}
                      {isTextarea(key) ? (
                        <Textarea
                          value={values[key] || ""}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                          className="border-[#D0D5DC] rounded-lg"
                          rows={3}
                        />
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          value={values[key] || ""}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                          className="border-[#D0D5DC] rounded-lg max-w-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
