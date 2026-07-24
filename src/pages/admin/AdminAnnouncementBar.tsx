import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Loader2, Megaphone, Save, Eye, EyeOff, Coins, ImageIcon, ChevronRight } from "lucide-react";


export default function AdminAnnouncementBar() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [crowdfundingEnabled, setCrowdfundingEnabled] = useState(true);
  const [text, setText] = useState("");
  const [textNl, setTextNl] = useState("");
  const [textEn, setTextEn] = useState("");
  const [textDe, setTextDe] = useState("");
  // Bandeau partenaire sous galerie médias
  const [mbEnabled, setMbEnabled] = useState(true);
  const [mbTitle, setMbTitle] = useState("");
  const [mbSubtitle, setMbSubtitle] = useState("");
  const [mbCtaLabel, setMbCtaLabel] = useState("");
  const [mbCtaUrl, setMbCtaUrl] = useState("");


  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_config")
      .select(
        "investment_banner_enabled, investment_banner_text, investment_banner_text_nl, investment_banner_text_en, investment_banner_text_de, crowdfunding_enabled, media_banner_enabled, media_banner_title, media_banner_subtitle, media_banner_cta_label, media_banner_cta_url"
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (data) {
      setEnabled(data.investment_banner_enabled);
      setCrowdfundingEnabled((data as any).crowdfunding_enabled ?? true);
      setText(data.investment_banner_text ?? "");
      setTextNl((data as any).investment_banner_text_nl ?? "");
      setTextEn((data as any).investment_banner_text_en ?? "");
      setTextDe((data as any).investment_banner_text_de ?? "");
      setMbEnabled((data as any).media_banner_enabled ?? true);
      setMbTitle((data as any).media_banner_title ?? "");
      setMbSubtitle((data as any).media_banner_subtitle ?? "");
      setMbCtaLabel((data as any).media_banner_cta_label ?? "");
      setMbCtaUrl((data as any).media_banner_cta_url ?? "");
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
        investment_banner_text_nl: textNl.trim() || null,
        investment_banner_text_en: textEn.trim() || null,
        investment_banner_text_de: textDe.trim() || null,
        crowdfunding_enabled: crowdfundingEnabled,
        media_banner_enabled: mbEnabled,
        media_banner_title: mbTitle.trim() || null,
        media_banner_subtitle: mbSubtitle.trim() || null,
        media_banner_cta_label: mbCtaLabel.trim() || null,
        media_banner_cta_url: mbCtaUrl.trim() || null,
      } as any)

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
          <CardTitle className="flex items-center gap-2">
            <Coins className={`h-5 w-5 ${crowdfundingEnabled ? "text-green-600" : "text-muted-foreground"}`} />
            Crowdfunding actif
          </CardTitle>
          <CardDescription>
            Quand activé, le bandeau redirige vers <code className="px-1 rounded bg-muted">/invest</code> (Tax Shelter / levée de fonds). Désactivez à la clôture de la levée pour rendre le bandeau non cliquable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="crowdfunding" className="text-base font-medium cursor-pointer">
                Lien vers la page Investissement
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Statut actuel : {crowdfundingEnabled ? <span className="text-green-600 font-medium">Actif (clic → /invest)</span> : <span className="text-muted-foreground font-medium">Inactif (bandeau non cliquable)</span>}
              </p>
            </div>
            <Switch id="crowdfunding" checked={crowdfundingEnabled} onCheckedChange={setCrowdfundingEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Texte du bandeau (par langue)</CardTitle>
          <CardDescription>
            Renseignez le texte pour chaque langue. Si une langue est vide, le texte FR (puis le texte par défaut traduit) sera utilisé en fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { lang: "fr", label: "🇫🇷 Français (FR)", value: text, setter: setText, ph: "Investissez dans MediKong — Tax Shelter 45% — Levée de fonds Phase 2 ouverte" },
            { lang: "nl", label: "🇳🇱 Néerlandais (NL)", value: textNl, setter: setTextNl, ph: "Investeer in MediKong — Tax Shelter 45% — Fondsenwerving Fase 2 open" },
            { lang: "en", label: "🇬🇧 Anglais (EN)", value: textEn, setter: setTextEn, ph: "Invest in MediKong — Tax Shelter 45% — Phase 2 fundraising open" },
            { lang: "de", label: "🇩🇪 Allemand (DE)", value: textDe, setter: setTextDe, ph: "Investieren Sie in MediKong — Tax Shelter 45% — Phase 2 Fundraising offen" },
          ] as const).map((row) => (
            <div key={row.lang} className="space-y-1.5">
              <Label className="text-sm font-medium">{row.label}</Label>
              <Textarea
                value={row.value}
                onChange={(e) => row.setter(e.target.value)}
                placeholder={row.ph}
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{row.value.length} / 200 caractères</p>
            </div>
          ))}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className={`h-5 w-5 ${mbEnabled ? "text-green-600" : "text-muted-foreground"}`} />
            Bandeau partenaire sous la galerie médias
          </CardTitle>
          <CardDescription>
            Affiché sous les médias officiels des fiches marque (<code className="px-1 rounded bg-muted">/marques/:slug</code>) et fabricant (<code className="px-1 rounded bg-muted">/fabricant/:slug</code>). Idéal pour pousser un partenaire sourceur (MediKong, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="mb-enabled" className="text-base font-medium cursor-pointer">Afficher le bandeau</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Statut : {mbEnabled ? <span className="text-green-600 font-medium">Visible</span> : <span className="text-muted-foreground font-medium">Masqué</span>}
              </p>
            </div>
            <Switch id="mb-enabled" checked={mbEnabled} onCheckedChange={setMbEnabled} />
          </div>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Titre (H2)</Label>
              <Input value={mbTitle} onChange={(e) => setMbTitle(e.target.value)} placeholder="Vendez mieux vos produits grâce aux supports de nos laboratoires et marques partenaires !" maxLength={180} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Sous-titre</Label>
              <Textarea value={mbSubtitle} onChange={(e) => setMbSubtitle(e.target.value)} rows={2} placeholder="Diffusez simplement et rapidement tous vos supports médias grâce à notre partenaire MediKong." maxLength={240} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-sm font-medium">Libellé CTA</Label>
                <Input value={mbCtaLabel} onChange={(e) => setMbCtaLabel(e.target.value)} placeholder="Découvrir MediKong" maxLength={40} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-sm font-medium">URL du CTA</Label>
                <Input value={mbCtaUrl} onChange={(e) => setMbCtaUrl(e.target.value)} placeholder="https://medikong.com/" type="url" />
              </div>
            </div>
          </div>

          {mbEnabled && (mbCtaUrl || mbTitle) && (
            <div className="rounded-xl border border-mk-line bg-gradient-to-r from-mk-navy via-mk-navy to-mk-blue p-5 text-white">
              <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Aperçu</p>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  {mbTitle && <div className="font-bold text-base">{mbTitle}</div>}
                  {mbSubtitle && <div className="text-sm text-white/80 mt-0.5">{mbSubtitle}</div>}
                </div>
                <span className="inline-flex items-center gap-1.5 bg-white text-mk-navy text-sm font-semibold px-4 py-2 rounded-lg shrink-0">
                  {mbCtaLabel || "En savoir plus"} <ChevronRight size={14} />
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>



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
