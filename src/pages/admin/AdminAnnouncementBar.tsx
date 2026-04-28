import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Megaphone, Save, Eye, EyeOff } from "lucide-react";

export default function AdminAnnouncementBar() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_config")
      .select("investment_banner_enabled, investment_banner_text")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (data) {
      setEnabled(data.investment_banner_enabled);
      setText(data.investment_banner_text ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        investment_banner_enabled: enabled,
        investment_banner_text: text.trim() || null,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bandeau mis à jour", description: enabled ? "Le bandeau est désormais visible." : "Le bandeau est masqué." });
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-3xl">
      <Helmet>
        <title>Bandeau d'annonce — MediKong Admin</title>
      </Helmet>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Megaphone className="h-7 w-7" />
          Bandeau d'annonce
        </h1>
        <p className="text-muted-foreground mt-1">
          Active, désactive ou modifie le bandeau bleu défilant en haut du site (Tax Shelter / levée de fonds).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {enabled ? <Eye className="h-5 w-5 text-green-600" /> : <EyeOff className="h-5 w-5 text-muted-foreground" />}
            Visibilité
          </CardTitle>
          <CardDescription>
            Quand désactivé, le bandeau disparaît immédiatement pour tous les visiteurs (cache 5 min côté navigateur).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="enabled" className="text-base font-medium cursor-pointer">
                Afficher le bandeau d'annonce
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Statut actuel : {enabled ? <span className="text-green-600 font-medium">Visible</span> : <span className="text-muted-foreground font-medium">Masqué</span>}
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Texte du bandeau</CardTitle>
          <CardDescription>
            Laissez vide pour utiliser le texte par défaut (traduit selon la langue du visiteur).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte"
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">{text.length} / 200 caractères</p>
        </CardContent>
      </Card>

      {enabled && (
        <Card className="bg-mk-blue border-mk-blue">
          <CardContent className="py-3">
            <p className="text-xs text-white/70 mb-2 uppercase tracking-wide">Aperçu</p>
            <p className="text-white text-sm font-medium">
              🚀 {text.trim() || "Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte"} →
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
