import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { BrandFactSheet } from "@/components/brand/BrandFactSheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye, ExternalLink, Shield, Info } from "lucide-react";

const AFMPS_OPTIONS: { value: "agreed" | "not_applicable" | "not_agreed"; label: string }[] = [
  { value: "agreed", label: "Agréé" },
  { value: "not_applicable", label: "Non concerné" },
  { value: "not_agreed", label: "Non agréé" },
];

const DISTRIBUTION_OPTIONS: { value: "official" | "authorized" | "partner"; label: string }[] = [
  { value: "official", label: "Distribution officielle" },
  { value: "authorized", label: "Distributeur agréé" },
  { value: "partner", label: "Partenaire MediKong" },
];

const CERT_PRESETS = [
  "iso_22716", "iso_13485", "iso_9001", "gmp_pharma",
  "cruelty_free", "bio", "halal", "vegan", "ecocert", "fda",
];

const COUNTRY_PRESETS = ["BE", "FR", "DE", "NL", "LU", "IT", "ES", "CH", "GB", "US", "PL", "SE", "DK", "JP", "AT", "IE"];

type BrandForm = {
  // Compliance
  parent_company: string | null;
  country_hq: string | null;
  main_category: string | null;
  year_entered_be_market: number | null;
  afmps_status: "agreed" | "not_applicable" | "not_agreed" | null;
  ce_marking: boolean | null;
  certifications: string[];
  manufacturing_countries: string[];
  inami_reimbursement_pct: number | null;
  // Logistics / market
  distribution_type: "official" | "authorized" | "partner" | null;
  google_trends_12m: number[] | null;
  google_trends_trend_pct: number | null;
  officinal_coverage_pct: number | null;
  press_mentions_12m: number | null;
};

const emptyForm: BrandForm = {
  parent_company: null,
  country_hq: null,
  main_category: null,
  year_entered_be_market: null,
  afmps_status: null,
  ce_marking: null,
  certifications: [],
  manufacturing_countries: [],
  inami_reimbursement_pct: null,
  distribution_type: null,
  google_trends_12m: null,
  google_trends_trend_pct: null,
  officinal_coverage_pct: null,
  press_mentions_12m: null,
};

const SELECT_COLS = [
  "id, slug, name, logo_url, description, product_count, is_active, is_top20, sources_last_updated",
  "parent_company, country_hq, main_category, year_entered_be_market",
  "afmps_status, ce_marking, certifications, manufacturing_countries",
  "inami_reimbursement_pct, inami_categories, distribution_type",
  "google_trends_12m, google_trends_trend_pct, officinal_coverage_pct, press_mentions_12m",
].join(", ");

export default function AdminBrandTransparenceEdit() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [trendsRaw, setTrendsRaw] = useState<string>("");

  const { data: brand, isLoading } = useQuery({
    queryKey: ["admin-brand-transparence", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands" as any)
        .select(SELECT_COLS)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!brand) return;
    setForm({
      parent_company: brand.parent_company ?? null,
      country_hq: brand.country_hq ?? null,
      main_category: brand.main_category ?? null,
      year_entered_be_market: brand.year_entered_be_market ?? null,
      afmps_status: brand.afmps_status ?? null,
      ce_marking: brand.ce_marking ?? null,
      certifications: brand.certifications ?? [],
      manufacturing_countries: brand.manufacturing_countries ?? [],
      inami_reimbursement_pct: brand.inami_reimbursement_pct ?? null,
      distribution_type: brand.distribution_type ?? null,
      google_trends_12m: brand.google_trends_12m ?? null,
      google_trends_trend_pct: brand.google_trends_trend_pct ?? null,
      officinal_coverage_pct: brand.officinal_coverage_pct ?? null,
      press_mentions_12m: brand.press_mentions_12m ?? null,
    });
    setTrendsRaw((brand.google_trends_12m ?? []).join(", "));
  }, [brand]);

  // Preview brand: merge form into brand for live BrandFactSheet rendering
  const previewBrand = useMemo(() => {
    if (!brand) return null;
    return {
      ...brand,
      ...form,
      // sources_last_updated reflects "now" in preview to convey effect of saving
      sources_last_updated: new Date().toISOString(),
    };
  }, [brand, form]);

  const set = <K extends keyof BrandForm>(k: K, v: BrandForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const toggleArrayValue = (k: "certifications" | "manufacturing_countries", v: string) => {
    setForm((f) => {
      const arr = f[k] ?? [];
      return { ...f, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  };

  const parseTrends = (raw: string): number[] | null => {
    const parts = raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    return parts.length ? parts : null;
  };

  const handleSave = async () => {
    if (!brand) return;
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        google_trends_12m: parseTrends(trendsRaw),
        sources_last_updated: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("brands" as any)
        .update(payload)
        .eq("id", brand.id);
      if (error) throw error;
      toast.success("Fiche transparence enregistrée");
      qc.invalidateQueries({ queryKey: ["admin-brand-transparence", slug] });
      qc.invalidateQueries({ queryKey: ["brand", slug] });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!brand) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Marque introuvable.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/admin/marques")}>
          <ArrowLeft size={14} className="mr-1" /> Retour
        </Button>
      </div>
    );
  }

  return (
    <div>
      <AdminTopBar
        title={`Transparence — ${brand.name}`}
        subtitle="Saisie des données réglementaires & signaux marché"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/marques"><ArrowLeft size={14} className="mr-1" /> Retour</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`/marques/${brand.slug}`, "_blank")}>
              <ExternalLink size={14} className="mr-1" /> Page publique
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-mk-blue hover:bg-mk-blue/90">
              <Save size={14} className="mr-1" /> {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ─── LEFT: Form ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-emerald-600" />
              <h3 className="text-sm font-bold">Conformité & qualité</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Société mère</Label>
                <Input
                  value={form.parent_company ?? ""}
                  onChange={(e) => set("parent_company", e.target.value || null)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Pays du siège</Label>
                <Select value={form.country_hq ?? ""} onValueChange={(v) => set("country_hq", v || null)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_PRESETS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Catégorie principale</Label>
                <Input
                  value={form.main_category ?? ""}
                  onChange={(e) => set("main_category", e.target.value || null)}
                  className="h-8 text-xs"
                  placeholder="Ex : Cosméto, Compléments…"
                />
              </div>
              <div>
                <Label className="text-xs">Année d'arrivée marché BE</Label>
                <Input
                  type="number" min={1900} max={new Date().getFullYear()}
                  value={form.year_entered_be_market ?? ""}
                  onChange={(e) => set("year_entered_be_market", e.target.value ? Number(e.target.value) : null)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Statut AFMPS</Label>
                <Select value={form.afmps_status ?? ""} onValueChange={(v) => set("afmps_status", (v || null) as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {AFMPS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-col">
                  <Label className="text-xs">Marquage CE</Label>
                  <div className="flex items-center gap-2 h-8">
                    <Switch
                      checked={form.ce_marking === true}
                      onCheckedChange={(v) => set("ce_marking", v ? true : false)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.ce_marking === true ? "Oui" : form.ce_marking === false ? "Non concerné" : "—"}
                    </span>
                    {form.ce_marking !== null && (
                      <button type="button" className="text-[10px] underline text-mk-ter" onClick={() => set("ce_marking", null)}>
                        Réinit.
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">% catalogue remboursé INAMI</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.inami_reimbursement_pct ?? ""}
                  onChange={(e) => set("inami_reimbursement_pct", e.target.value ? Number(e.target.value) : null)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs">Certifications</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CERT_PRESETS.map((c) => {
                  const active = form.certifications.includes(c);
                  return (
                    <Badge
                      key={c}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => toggleArrayValue("certifications", c)}
                    >
                      {c}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs">Pays de fabrication</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {COUNTRY_PRESETS.map((c) => {
                  const active = form.manufacturing_countries.includes(c);
                  return (
                    <Badge
                      key={c}
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => toggleArrayValue("manufacturing_countries", c)}
                    >
                      {c}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3">Logistique & relation MediKong</h3>
            <div>
              <Label className="text-xs">Type de relation</Label>
              <Select value={form.distribution_type ?? ""} onValueChange={(v) => set("distribution_type", (v || null) as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {DISTRIBUTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3">Signaux marché</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-xs inline-flex items-center gap-1">
                  Google Trends BE — 12 derniers mois
                  <Info size={11} className="text-mk-ter" />
                </Label>
                <Textarea
                  value={trendsRaw}
                  onChange={(e) => setTrendsRaw(e.target.value)}
                  placeholder="12 valeurs entre 0 et 100, séparées par virgules. Ex : 32, 35, 40, 38, 45, 50, 48, 52, 60, 58, 62, 65"
                  className="text-xs min-h-[60px]"
                />
                <p className="text-[10px] text-mk-ter mt-1">
                  {parseTrends(trendsRaw)?.length ?? 0} valeurs détectées (max 100, idéalement 12).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Tendance % (vs N-1)</Label>
                  <Input
                    type="number"
                    value={form.google_trends_trend_pct ?? ""}
                    onChange={(e) => set("google_trends_trend_pct", e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">% officinal</Label>
                  <Input
                    type="number" min={0} max={100}
                    value={form.officinal_coverage_pct ?? ""}
                    onChange={(e) => set("officinal_coverage_pct", e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Mentions presse 12m</Label>
                  <Input
                    type="number" min={0}
                    value={form.press_mentions_12m ?? ""}
                    onChange={(e) => set("press_mentions_12m", e.target.value ? Number(e.target.value) : null)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ─── RIGHT: Live preview ─────────────────────────────────────── */}
        <div className="xl:sticky xl:top-4 self-start">
          <Tabs defaultValue="preview">
            <TabsList className="mb-2">
              <TabsTrigger value="preview" className="text-xs">
                <Eye size={12} className="mr-1" /> Aperçu page publique
              </TabsTrigger>
              <TabsTrigger value="json" className="text-xs">JSON brut</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="rounded-lg border border-mk-line bg-mk-alt/30 p-3">
                {previewBrand && <BrandFactSheet brand={previewBrand as any} />}
              </div>
            </TabsContent>
            <TabsContent value="json">
              <pre className="text-[10px] bg-muted/40 rounded p-3 overflow-auto max-h-[600px]">
                {JSON.stringify({ ...form, google_trends_12m: parseTrends(trendsRaw) }, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
