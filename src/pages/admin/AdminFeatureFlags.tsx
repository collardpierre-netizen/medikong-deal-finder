import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ToggleLeft, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restockEnabled, setRestockEnabled] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_config")
      .select("restock_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (data) {
      setRestockEnabled(data.restock_enabled ?? true);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({ restock_enabled: restockEnabled })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["site-features"] });
      toast({ title: "Enregistré", description: restockEnabled ? "ReStock visible dans le menu." : "ReStock masqué du menu." });
    }
  }

  if (loading) {
    return <div className="container mx-auto py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-3xl">
      <Helmet><title>Modules du site — MediKong Admin</title></Helmet>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ToggleLeft className="h-7 w-7" />
          Modules du site
        </h1>
        <p className="text-muted-foreground mt-1">
          Activez ou désactivez les onglets affichés dans la barre de navigation publique.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ReStock</CardTitle>
          <CardDescription>
            Contrôle l'onglet « ReStock » dans la barre de navigation publique. Les pages ReStock restent accessibles directement par URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="restock" className="text-base font-medium cursor-pointer">
                Afficher l'onglet ReStock
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Statut actuel : {restockEnabled ? <span className="text-green-600 font-medium">Visible</span> : <span className="text-muted-foreground font-medium">Masqué</span>}
              </p>
            </div>
            <Switch id="restock" checked={restockEnabled} onCheckedChange={setRestockEnabled} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load} disabled={saving}>Annuler</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
