import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Globe, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Country {
  code: string;
  name: string;
  name_local: string | null;
  flag_emoji: string | null;
  currency: string;
  default_vat_rate: number | null;
  default_language: string | null;
  is_active: boolean;
  qogita_sync_enabled: boolean;
  display_order: number;
  last_sync_at: string | null;
}

export default function AdminCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [offerCounts, setOfferCounts] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("countries")
      .select("*")
      .order("display_order") as { data: Country[] | null };
    if (data) setCountries(data);

    // Get offer counts per country
    const { data: offers } = await supabase
      .from("offers")
      .select("country_code");
    if (offers) {
      const counts: Record<string, number> = {};
      offers.forEach((o: any) => { counts[o.country_code] = (counts[o.country_code] || 0) + 1; });
      setOfferCounts(counts);
    }

    // Get product counts from product_country_stats
    const { data: stats } = await supabase
      .from("product_country_stats")
      .select("country_code");
    if (stats) {
      const counts: Record<string, number> = {};
      stats.forEach((s: any) => { counts[s.country_code] = (counts[s.country_code] || 0) + 1; });
      setProductCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleField = async (code: string, field: "is_active" | "qogita_sync_enabled", value: boolean) => {
    const { error } = await supabase
      .from("countries")
      .update({ [field]: value } as any)
      .eq("code", code);
    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      setCountries(prev => prev.map(c => c.code === code ? { ...c, [field]: value } : c));
      toast.success(`${code} mis à jour`);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Gestion des pays</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Activez ou désactivez les pays pour le marketplace. Seuls les pays actifs sont visibles par les acheteurs.
      </p>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase">
              <th className="text-left p-3">Pays</th>
              <th className="text-center p-3">TVA</th>
              <th className="text-center p-3">Langue</th>
              <th className="text-center p-3">Produits</th>
              <th className="text-center p-3">Offres</th>
              <th className="text-center p-3">Actif</th>
              <th className="text-center p-3">Sync Qogita</th>
            </tr>
          </thead>
          <tbody>
            {countries.map(c => (
              <tr key={c.code} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c.flag_emoji}</span>
                    <div>
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.code} — {c.name_local}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center p-3">
                  <Badge variant="outline">{c.default_vat_rate}%</Badge>
                </td>
                <td className="text-center p-3 text-sm text-muted-foreground uppercase">{c.default_language}</td>
                <td className="text-center p-3 font-mono text-sm">{productCounts[c.code] || 0}</td>
                <td className="text-center p-3 font-mono text-sm">{offerCounts[c.code] || 0}</td>
                <td className="text-center p-3">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => toggleField(c.code, "is_active", v)}
                  />
                </td>
                <td className="text-center p-3">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={c.qogita_sync_enabled}
                      onCheckedChange={(v) => toggleField(c.code, "qogita_sync_enabled", v)}
                    />
                    {c.last_sync_at && (
                      <span title={`Dernière sync: ${new Date(c.last_sync_at).toLocaleString()}`}>
                        <RefreshCw size={12} className="text-muted-foreground" />
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
