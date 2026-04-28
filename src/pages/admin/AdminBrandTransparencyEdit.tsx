import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ExternalLink, Save, Loader2, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { BrandFactSheet } from "@/components/brand/BrandFactSheet";
import { z } from "zod";

const AFMPS = ["agreed", "not_applicable", "not_agreed"] as const;
const DISTRIB = ["official", "authorized", "partner"] as const;
const CERT_OPTIONS = [
  "iso_22716", "iso_13485", "iso_9001", "gmp_pharma",
  "cruelty_free", "bio", "halal", "vegan", "ecocert", "fda",
];

// Schéma serveur de garde-fou (le check constraint DB renforce déjà côté SQL)
const FormSchema = z.object({
  parent_company: z.string().trim().max(200).optional().nullable(),
  country_hq: z.string().trim().max(2).optional().nullable(),
  main_category: z.string().trim().max(100).optional().nullable(),
  year_entered_be_market: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  afmps_status: z.enum(AFMPS).optional().nullable(),
  ce_marking: z.boolean().optional().nullable(),
  distribution_type: z.enum(DISTRIB).optional().nullable(),
  inami_reimbursement_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  officinal_coverage_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  press_mentions_12m: z.coerce.number().int().min(0).optional().nullable(),
  google_trends_trend_pct: z.coerce.number().min(-100).max(1000).optional().nullable(),
  certifications: z.array(z.string()).optional().nullable(),
  manufacturing_countries: z.array(z.string()).optional().nullable(),
  google_trends_12m: z.array(z.number()).optional().nullable(),
});

type FormState = z.input<typeof FormSchema>;

const csvToArr = (s: string) =>
  s.split(",").map(x => x.trim().toUpperCase()).filter(Boolean);

const trendsToArr = (s: string): number[] =>
  s.split(",").map(x => Number(x.trim())).filter(n => !isNaN(n));

export default function AdminBrandTransparencyEdit() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ─── Fetch brand ─────────────────────────────────────────────────────────
  const { data: brand, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-brand-edit", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Marque introuvable");
      return data as any;
    },
  });

  const [form, setForm] = useState<FormState>({});
  const [certsInput, setCertsInput] = useState<string[]>([]);
  const [mfgInput, setMfgInput] = useState("");
  const [trendsInput, setTrendsInput] = useState("");

  useEffect(() => {
    if (!brand) return;
    setForm({
      parent_company: brand.parent_company ?? "",
      country_hq: brand.country_hq ?? "",
      main_category: brand.main_category ?? "",
      year_entered_be_market: brand.year_entered_be_market ?? null,
      afmps_status: brand.afmps_status ?? null,
      ce_marking: brand.ce_marking,
      distribution_type: brand.distribution_type ?? null,
      inami_reimbursement_pct: brand.inami_reimbursement_pct ?? null,
      officinal_coverage_pct: brand.officinal_coverage_pct ?? null,
      press_mentions_12m: brand.press_mentions_12m ?? null,
      google_trends_trend_pct: brand.google_trends_trend_pct ?? null,
    });
    setCertsInput(Array.isArray(brand.certifications) ? brand.certifications : []);
    setMfgInput((brand.manufacturing_countries ?? []).join(", "));
    setTrendsInput(Array.isArray(brand.google_trends_12m) ? brand.google_trends_12m.join(", ") : "");
  }, [brand]);

  // ─── Save mutation ───────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        country_hq: form.country_hq ? String(form.country_hq).toUpperCase().slice(0, 2) : null,
        certifications: certsInput,
        manufacturing_countries: csvToArr(mfgInput),
        google_trends_12m: trendsToArr(trendsInput),
      };
      const parsed = FormSchema.safeParse(payload);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new Error(`${first.path.join(".")}: ${first.message}`);
      }

      const { error } = await supabase
        .from("brands")
        .update({
          ...parsed.data,
          sources_last_updated: new Date().toISOString(),
        })
        .eq("id", brand!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Données réglementaires mises à jour");
      qc.invalidateQueries({ queryKey: ["admin-brand-edit", slug] });
      qc.invalidateQueries({ queryKey: ["brand", slug] });
      qc.invalidateQueries({ queryKey: ["brand-fact-sheet", brand?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur lors de la sauvegarde"),
  });

  // ─── Brand object pour le preview (merge form values en direct) ─────────
  const previewBrand = useMemo(() => {
    if (!brand) return null;
    return {
      ...brand,
      ...form,
      country_hq: form.country_hq ? String(form.country_hq).toUpperCase().slice(0, 2) : null,
      certifications: certsInput,
      manufacturing_countries: csvToArr(mfgInput),
      google_trends_12m: trendsToArr(trendsInput),
    };
  }, [brand, form, certsInput, mfgInput, trendsInput]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-mk-sec">
        <Loader2 className="animate-spin" size={16} /> Chargement…
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="p-8">
        <p className="text-rose-600 mb-4">Marque introuvable</p>
        <Button variant="outline" onClick={() => navigate("/admin/marques")}>
          <ArrowLeft size={14} className="mr-1" /> Retour
        </Button>
      </div>
    );
  }

  const toggleCert = (key: string) => {
    setCertsInput(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  return (
    <div>
      <AdminTopBar
        title={`Transparence — ${brand.name}`}
        subtitle="Données réglementaires & signaux marché (saisie manuelle)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/marques"><ArrowLeft size={14} className="mr-1" /> Retour</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/marques/${brand.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink size={14} className="mr-1" /> Page publique
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} className="mr-1" /> Recharger
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
              Enregistrer
            </Button>
          </div>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── FORMULAIRE ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-mk-navy mb-4">Identité & gouvernance</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Société mère</Label>
                <Input value={form.parent_company ?? ""} onChange={e => setForm(f => ({ ...f, parent_company: e.target.value }))} placeholder="Ex. L'Oréal SA" />
              </div>
              <div>
                <Label className="text-xs">Pays HQ (code ISO 2)</Label>
                <Input maxLength={2} value={form.country_hq ?? ""} onChange={e => setForm(f => ({ ...f, country_hq: e.target.value.toUpperCase() }))} placeholder="BE" />
              </div>
              <div>
                <Label className="text-xs">Catégorie principale</Label>
                <Input value={form.main_category ?? ""} onChange={e => setForm(f => ({ ...f, main_category: e.target.value }))} placeholder="Dermo-cosmétique" />
              </div>
              <div>
                <Label className="text-xs">Sur le marché belge depuis (année)</Label>
                <Input type="number" min={1800} max={new Date().getFullYear()} value={form.year_entered_be_market ?? ""} onChange={e => setForm(f => ({ ...f, year_entered_be_market: e.target.value ? Number(e.target.value) : null }))} placeholder="1985" />
              </div>
              <div>
                <Label className="text-xs">Type de relation</Label>
                <Select value={form.distribution_type ?? "none"} onValueChange={v => setForm(f => ({ ...f, distribution_type: v === "none" ? null : v as any }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non renseigné</SelectItem>
                    <SelectItem value="official">Distribution officielle</SelectItem>
                    <SelectItem value="authorized">Distributeur agréé</SelectItem>
                    <SelectItem value="partner">Partenaire MediKong</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-mk-navy mb-4">Conformité réglementaire</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Statut AFMPS</Label>
                <Select value={form.afmps_status ?? "none"} onValueChange={v => setForm(f => ({ ...f, afmps_status: v === "none" ? null : v as any }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non renseigné</SelectItem>
                    <SelectItem value="agreed">Agréé</SelectItem>
                    <SelectItem value="not_applicable">Non concerné</SelectItem>
                    <SelectItem value="not_agreed">Non agréé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <div className="flex-1">
                  <Label className="text-xs">Marquage CE</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Switch
                      checked={form.ce_marking === true}
                      onCheckedChange={v => setForm(f => ({ ...f, ce_marking: v }))}
                    />
                    <span className="text-xs text-mk-sec">{form.ce_marking === true ? "Oui" : form.ce_marking === false ? "Non concerné" : "—"}</span>
                  </div>
                </div>
                {form.ce_marking !== null && (
                  <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => setForm(f => ({ ...f, ce_marking: null }))}>Vider</Button>
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Pays de fabrication (codes ISO 2, séparés par virgule)</Label>
                <Input value={mfgInput} onChange={e => setMfgInput(e.target.value)} placeholder="FR, DE, IT" />
                <p className="text-[11px] text-mk-ter mt-1">Affichés sous forme de drapeaux 🇫🇷 🇩🇪…</p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs mb-2 block">Certifications qualité</Label>
                <div className="flex flex-wrap gap-2">
                  {CERT_OPTIONS.map(c => (
                    <Badge
                      key={c}
                      variant={certsInput.includes(c) ? "default" : "outline"}
                      className="cursor-pointer text-[11px]"
                      onClick={() => toggleCert(c)}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">% catalogue remboursé INAMI</Label>
                <Input type="number" min={0} max={100} step={0.1} value={form.inami_reimbursement_pct ?? ""} onChange={e => setForm(f => ({ ...f, inami_reimbursement_pct: e.target.value ? Number(e.target.value) : null }))} placeholder="0–100" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-bold text-mk-navy mb-4">Signaux marché</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Couverture officinale BE (%)</Label>
                <Input type="number" min={0} max={100} step={0.1} value={form.officinal_coverage_pct ?? ""} onChange={e => setForm(f => ({ ...f, officinal_coverage_pct: e.target.value ? Number(e.target.value) : null }))} placeholder="0–100" />
              </div>
              <div>
                <Label className="text-xs">Mentions presse pro (12 mois)</Label>
                <Input type="number" min={0} value={form.press_mentions_12m ?? ""} onChange={e => setForm(f => ({ ...f, press_mentions_12m: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <Label className="text-xs">Tendance Google Trends (% sur 12 mois)</Label>
                <Input type="number" step={0.1} value={form.google_trends_trend_pct ?? ""} onChange={e => setForm(f => ({ ...f, google_trends_trend_pct: e.target.value ? Number(e.target.value) : null }))} placeholder="ex. 12.5" />
              </div>
              <div>
                <Label className="text-xs">Série 12 mois (12 valeurs séparées par virgule)</Label>
                <Input value={trendsInput} onChange={e => setTrendsInput(e.target.value)} placeholder="40, 42, 50, 55, 60, 65, 70, 68, 72, 75, 80, 85" />
              </div>
            </div>
            <p className="text-[11px] text-mk-ter mt-3">
              Les valeurs sont affichées avec un disclaimer source côté public. Source automatique « Google Trends BE » lorsque renseignée.
            </p>
          </Card>
        </div>

        {/* ─── PREVIEW ─────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3 mb-3 bg-mk-alt border-dashed">
            <div className="flex items-center gap-2 text-xs text-mk-sec">
              <Eye size={14} /> Aperçu en direct du rendu sur <code className="text-mk-navy">/marques/{brand.slug}</code> — non sauvegardé tant que vous n'avez pas cliqué sur Enregistrer.
            </div>
          </Card>
          <Tabs defaultValue="factsheet">
            <TabsList>
              <TabsTrigger value="factsheet">Fact sheet publique</TabsTrigger>
              <TabsTrigger value="raw">JSON brut</TabsTrigger>
            </TabsList>
            <TabsContent value="factsheet" className="mt-3">
              {previewBrand && <BrandFactSheet brand={previewBrand as any} />}
            </TabsContent>
            <TabsContent value="raw" className="mt-3">
              <Card className="p-3">
                <pre className="text-[11px] whitespace-pre-wrap break-all text-mk-navy max-h-[600px] overflow-auto">
                  {JSON.stringify(previewBrand, null, 2)}
                </pre>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
