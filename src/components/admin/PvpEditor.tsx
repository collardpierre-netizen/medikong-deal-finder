import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Trash2, TrendingUp } from "lucide-react";
import { formatUpdatedAtFull } from "@/lib/format-date";

const SOURCES = [
  { value: "apb", label: "APB (Belgique – officiel)" },
  { value: "pmr", label: "PMR (cosmétique)" },
  { value: "manufacturer", label: "Fabricant" },
  { value: "distributor", label: "Distributeur" },
  { value: "manual", label: "Manuel admin" },
];

interface Props {
  productId: string;
  initialPvpTtcCents?: number | null;
  initialSource?: string | null;
  initialUpdatedAt?: string | null;
  initialCountryCode?: string | null;
  onSaved?: () => void;
}

/**
 * Éditeur du Prix Public Conseillé (PVP TTC) pour un produit.
 * Réservé aux admins (vérifié côté UI + RLS Supabase).
 */
export default function PvpEditor({
  productId,
  initialPvpTtcCents,
  initialSource,
  initialUpdatedAt,
  initialCountryCode,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const [pvpTtc, setPvpTtc] = useState<string>(
    initialPvpTtcCents != null ? (initialPvpTtcCents / 100).toFixed(2) : ""
  );
  const [source, setSource] = useState<string>(initialSource ?? "apb");
  const [country, setCountry] = useState<string>(initialCountryCode ?? "BE");

  useEffect(() => {
    setPvpTtc(initialPvpTtcCents != null ? (initialPvpTtcCents / 100).toFixed(2) : "");
    setSource(initialSource ?? "apb");
    setCountry(initialCountryCode ?? "BE");
  }, [initialPvpTtcCents, initialSource, initialCountryCode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cents = pvpTtc ? Math.round(parseFloat(pvpTtc.replace(",", ".")) * 100) : null;
      if (cents != null && (!Number.isFinite(cents) || cents <= 0)) {
        throw new Error("Prix TTC invalide");
      }
      const { error } = await supabase
        .from("products")
        .update({
          pvp_ttc_cents: cents,
          pvp_source: cents ? (source as any) : null,
          pvp_country_code: cents ? country : null,
          pvp_updated_at: cents ? new Date().toISOString() : null,
        })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prix public conseillé enregistré");
      qc.invalidateQueries({ queryKey: ["product-detail", productId] });
      qc.invalidateQueries({ queryKey: ["resolved-pvp", productId] });
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({ pvp_ttc_cents: null, pvp_source: null, pvp_updated_at: null })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      setPvpTtc("");
      toast.success("Prix public effacé");
      qc.invalidateQueries({ queryKey: ["product-detail", productId] });
      qc.invalidateQueries({ queryKey: ["resolved-pvp", productId] });
    },
  });

  return (
    <div className="p-5 rounded-[10px]" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-emerald-600" />
        <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>
          Prix public conseillé (TTC)
        </h3>
      </div>
      <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>
        Sert au calcul de la marge potentielle de revente affichée à l'acheteur.
        {initialUpdatedAt && (
          <> Dernière mise à jour : {formatUpdatedAtFull(initialUpdatedAt)}.</>
        )}
      </p>
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor="pvp-ttc" className="text-[12px]">PVP TTC (€)</Label>
          <Input
            id="pvp-ttc"
            type="number"
            step="0.01"
            min="0"
            value={pvpTtc}
            onChange={(e) => setPvpTtc(e.target.value)}
            placeholder="ex: 24.90"
          />
        </div>
        <div>
          <Label className="text-[12px]">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px]">Pays</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BE">🇧🇪 Belgique</SelectItem>
              <SelectItem value="FR">🇫🇷 France</SelectItem>
              <SelectItem value="LU">🇱🇺 Luxembourg</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save size={14} className="mr-1" />
          Enregistrer
        </Button>
        {initialPvpTtcCents != null && (
          <Button size="sm" variant="outline" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
            <Trash2 size={14} className="mr-1" />
            Effacer
          </Button>
        )}
      </div>
    </div>
  );
}
