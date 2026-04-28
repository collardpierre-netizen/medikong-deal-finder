import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shield, Truck, TrendingUp, Users, CheckCircle2, AlertTriangle, Info,
  XCircle, MinusCircle, Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { BrandReviewModal } from "./BrandReviewModal";
import { Button } from "@/components/ui/button";

const FLAG: Record<string, string> = {
  BE: "🇧🇪", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱", LU: "🇱🇺",
  IT: "🇮🇹", ES: "🇪🇸", CH: "🇨🇭", GB: "🇬🇧", US: "🇺🇸",
  PL: "🇵🇱", SE: "🇸🇪", DK: "🇩🇰", JP: "🇯🇵", AT: "🇦🇹", IE: "🇮🇪",
};

const CERT_LABELS: Record<string, string> = {
  iso_22716: "ISO 22716 (GMP cosméto)",
  iso_13485: "ISO 13485 (Dispositifs médicaux)",
  iso_9001: "ISO 9001",
  gmp_pharma: "GMP Pharma",
  cruelty_free: "Cruelty-free",
  bio: "Bio",
  halal: "Halal",
  vegan: "Vegan",
  ecocert: "Ecocert",
  fda: "FDA",
};

const certLabel = (k: string) => CERT_LABELS[k] ?? k;

interface BrandRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  product_count: number | null;
  parent_company: string | null;
  country_hq: string | null;
  main_category: string | null;
  year_entered_be_market: number | null;
  afmps_status: "agreed" | "not_applicable" | "not_agreed" | null;
  ce_marking: boolean | null;
  certifications: string[] | null;
  manufacturing_countries: string[] | null;
  inami_reimbursement_pct: number | null;
  inami_categories: Record<string, number> | null;
  google_trends_12m: number[] | null;
  google_trends_trend_pct: number | null;
  officinal_coverage_pct: number | null;
  press_mentions_12m: number | null;
  distribution_type: "official" | "authorized" | "partner" | null;
  is_top20: boolean;
  sources_last_updated: string | null;
}

interface LogisticsStats {
  brand_id: string;
  order_count_90d: number;
  avg_delivery_days: number | null;
  stock_availability_pct: number | null;
}

interface ReviewRow {
  id: string;
  reviewer_initials: string;
  reviewer_city: string | null;
  verified_buyer_orders_count: number;
  rating_quality: number;
  rating_delivery: number;
  rating_support: number;
  rating_documentation: number;
  rating_margin: number;
  comment: string | null;
  created_at: string;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Helpers UI ────────────────────────────────────────────────────────────
function SourceTooltip({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center text-mk-ter hover:text-mk-blue ml-1" aria-label="Source">
          <Info size={12} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-snug">{label}</TooltipContent>
    </Tooltip>
  );
}

function DataRow({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-mk-line last:border-0">
      <span className="text-xs text-mk-sec inline-flex items-center">
        {label}
        {tooltip && <SourceTooltip label={tooltip} />}
      </span>
      <span className="text-sm font-medium text-mk-navy text-right">{children}</span>
    </div>
  );
}

function StatusPill({ kind, children }: { kind: "ok" | "warn" | "ko" | "neutral"; children: React.ReactNode }) {
  const styles =
    kind === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    kind === "warn" ? "bg-amber-50 text-amber-700 border-amber-200" :
    kind === "ko" ? "bg-rose-50 text-rose-700 border-rose-200" :
    "bg-slate-50 text-slate-600 border-slate-200";
  const Icon = kind === "ok" ? CheckCircle2 : kind === "ko" ? XCircle : kind === "warn" ? AlertTriangle : MinusCircle;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      <Icon size={12} /> {children}
    </span>
  );
}

function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 pt-3 border-t border-mk-line text-[11px] text-mk-ter inline-flex items-start gap-1.5">
      <Info size={11} className="shrink-0 mt-0.5" /> <span>{children}</span>
    </p>
  );
}

function CardHeader({ icon: Icon, color, title }: { icon: any; color: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} />
      </div>
      <h3 className="text-base font-bold text-mk-navy">{title}</h3>
    </div>
  );
}

// ─── Sparkline (trends) ────────────────────────────────────────────────────
function Sparkline({ values, w = 120, h = 32 }: { values: number[]; w?: number; h?: number }) {
  if (!values?.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="text-mk-blue">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

// ─── Fact Sheet component ──────────────────────────────────────────────────
export function BrandFactSheet({ brand }: { brand: BrandRow }) {
  const { user } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: logistics } = useQuery({
    queryKey: ["brand-logistics-stats", brand.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_logistics_stats" as any)
        .select("brand_id, order_count_90d, avg_delivery_days, stock_availability_pct")
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as LogisticsStats) || null;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["brand-reviews", brand.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_reviews" as any)
        .select("id, reviewer_initials, reviewer_city, verified_buyer_orders_count, rating_quality, rating_delivery, rating_support, rating_documentation, rating_margin, comment, created_at")
        .eq("brand_id", brand.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as ReviewRow[]) || [];
    },
  });

  const { data: canReview } = useQuery({
    queryKey: ["brand-can-review", brand.id, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("user_has_ordered_brand" as any, { _user_id: user!.id, _brand_id: brand.id });
      if (error) return false;
      return !!data;
    },
  });

  // ── Determinist bullets (Section 5) ──────────────────────────────────────
  const yearsOnMarket = brand.year_entered_be_market ? new Date().getFullYear() - brand.year_entered_be_market : null;
  const positives: string[] = [];
  const watch: string[] = [];
  if (yearsOnMarket !== null && yearsOnMarket > 20) positives.push(`Marque historique en Belgique (${yearsOnMarket} ans)`);
  if ((brand.google_trends_trend_pct ?? 0) > 5) positives.push(`Demande patient en croissance (+${brand.google_trends_trend_pct?.toFixed(0)}%)`);
  if (brand.distribution_type === "official") positives.push("Distribution officielle MediKong");
  if ((brand.inami_reimbursement_pct ?? 0) > 30) positives.push(`Catalogue largement remboursé INAMI (${Math.round(brand.inami_reimbursement_pct!)}%)`);
  if ((brand.officinal_coverage_pct ?? 0) > 60) positives.push(`Couverture officinale large (${Math.round(brand.officinal_coverage_pct!)}%)`);
  if (brand.afmps_status === "agreed") positives.push("Agréé AFMPS");

  if (brand.inami_reimbursement_pct === 0) watch.push("Aucune référence remboursée INAMI");
  if (yearsOnMarket !== null && yearsOnMarket < 5) watch.push(`Marque récente sur le marché belge (${yearsOnMarket} an${yearsOnMarket > 1 ? "s" : ""})`);
  if ((logistics?.order_count_90d ?? 0) > 0 && (logistics?.order_count_90d ?? 0) < 30) watch.push("Données opérationnelles limitées (historique en construction)");
  if (brand.afmps_status === "not_agreed") watch.push("Statut AFMPS à vérifier");

  // ── Reviews aggregations (per criterion only, never global) ─────────────
  const enoughReviews = reviews.length >= 5;
  const avg = (key: keyof ReviewRow) =>
    enoughReviews ? (reviews.reduce((s, r) => s + (r[key] as number), 0) / reviews.length).toFixed(1) : "—";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ─── Section 1 : Conformité ──────────────────────────────────── */}
        <Card className="p-5">
          <CardHeader icon={Shield} color="bg-emerald-50 text-emerald-700" title="Conformité réglementaire & qualité" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
            <DataRow label="Statut AFMPS" tooltip="Source : AFMPS — agence fédérale des médicaments et produits de santé.">
              {brand.afmps_status === "agreed" && <StatusPill kind="ok">Agréé</StatusPill>}
              {brand.afmps_status === "not_applicable" && <StatusPill kind="neutral">Non concerné</StatusPill>}
              {brand.afmps_status === "not_agreed" && <StatusPill kind="ko">Non agréé</StatusPill>}
              {!brand.afmps_status && <span className="text-xs text-mk-ter">À renseigner</span>}
            </DataRow>
            <DataRow label="Marquage CE" tooltip="Conformité européenne — applicable aux dispositifs médicaux et certains cosmétiques.">
              {brand.ce_marking === true && <StatusPill kind="ok">Oui</StatusPill>}
              {brand.ce_marking === false && <StatusPill kind="neutral">Non concerné</StatusPill>}
              {brand.ce_marking === null && <span className="text-xs text-mk-ter">À renseigner</span>}
            </DataRow>
            <DataRow label="Sur le marché belge depuis" tooltip="Source : déclaration fabricant + Banque-Carrefour des Entreprises.">
              {brand.year_entered_be_market ? (
                <>{brand.year_entered_be_market} <span className="text-xs text-mk-sec">({yearsOnMarket} ans)</span></>
              ) : (
                <span className="text-xs text-mk-ter">—</span>
              )}
            </DataRow>
            <DataRow label="Pays de fabrication" tooltip="Source : déclaration fabricant.">
              {brand.manufacturing_countries?.length ? (
                <span className="text-base">{brand.manufacturing_countries.map(c => FLAG[c] ?? c).join(" ")}</span>
              ) : (
                <span className="text-xs text-mk-ter">—</span>
              )}
            </DataRow>
          </div>

          {/* Certifications */}
          <div className="mt-3">
            <div className="text-xs text-mk-sec mb-1.5 inline-flex items-center">
              Certifications qualité
              <SourceTooltip label="Sources : certifications publiques fabricants + organismes notifiés." />
            </div>
            {brand.certifications?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {brand.certifications.map(c => (
                  <Badge key={c} variant="secondary" className="text-[11px] font-normal">{certLabel(c)}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mk-ter">Aucune certification publique recensée.</p>
            )}
          </div>

          {/* INAMI */}
          {brand.inami_reimbursement_pct !== null && (
            <div className="mt-3 p-2.5 bg-mk-alt rounded-md">
              <div className="text-xs text-mk-sec inline-flex items-center">
                Présence INAMI
                <SourceTooltip label="Source : base de données INAMI/RIZIV. Mise à jour mensuelle." />
              </div>
              <div className="text-sm font-medium text-mk-navy mt-0.5">
                {Math.round(brand.inami_reimbursement_pct)}% du catalogue remboursé
                {brand.inami_categories && Object.keys(brand.inami_categories).length > 0 && (
                  <span className="text-xs text-mk-sec font-normal ml-2">
                    ({Object.entries(brand.inami_categories).map(([k, v]) => `Cat. ${k}: ${v}`).join(" · ")})
                  </span>
                )}
              </div>
            </div>
          )}

          <Disclaimer>
            Sources : Banque-Carrefour des Entreprises, AFMPS, certifications publiques des fabricants. Mise à jour mensuelle
            {brand.sources_last_updated && ` — dernière mise à jour ${fmtDate(brand.sources_last_updated)}`}.
          </Disclaimer>
        </Card>

        {/* ─── Section 2 : Logistique MediKong ─────────────────────────── */}
        <Card className="p-5">
          <CardHeader icon={Truck} color="bg-blue-50 text-mk-blue" title="Logistique MediKong" />
          {(logistics?.order_count_90d ?? 0) < 10 ? (
            <div className="p-3 bg-mk-alt rounded-md text-xs text-mk-sec inline-flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>Données insuffisantes — historique en construction ({logistics?.order_count_90d ?? 0} commande{(logistics?.order_count_90d ?? 0) > 1 ? "s" : ""} sur 90 jours).</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
              <DataRow label="Délai moyen de livraison" tooltip="Calculé sur les commandes des 90 derniers jours.">
                {logistics?.avg_delivery_days ? `${logistics.avg_delivery_days} jours` : "—"}
              </DataRow>
              <DataRow label="Disponibilité stock" tooltip="Part des offres en stock observées sur 90 jours.">
                {logistics?.stock_availability_pct !== null ? `${logistics?.stock_availability_pct}%` : "—"}
              </DataRow>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 mt-1">
            <DataRow label="Type de relation" tooltip="Type de partenariat commercial avec MediKong.">
              {brand.distribution_type === "official" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Distribution officielle</Badge>}
              {brand.distribution_type === "authorized" && <Badge className="bg-blue-100 text-mk-blue hover:bg-blue-100">Distributeur agréé</Badge>}
              {brand.distribution_type === "partner" && <Badge variant="secondary">Partenaire MediKong</Badge>}
              {!brand.distribution_type && <span className="text-xs text-mk-ter">À renseigner</span>}
            </DataRow>
          </div>

          <Disclaimer>Données calculées sur les 90 derniers jours. Mise à jour quotidienne.</Disclaimer>
        </Card>

        {/* ─── Section 3 : Signaux marché externes ────────────────────── */}
        <Card className="p-5">
          <CardHeader icon={TrendingUp} color="bg-violet-50 text-violet-700" title="Signaux marché" />
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 py-2 border-b border-mk-line">
              <span className="text-xs text-mk-sec inline-flex items-center">
                Recherches Google Belgique (12 mois)
                <SourceTooltip label="Source : Google Trends Belgique. Mise à jour mensuelle." />
              </span>
              <div className="flex items-center gap-2">
                {brand.google_trends_12m?.length ? <Sparkline values={brand.google_trends_12m as number[]} /> : <span className="text-xs text-mk-ter">—</span>}
                {brand.google_trends_trend_pct !== null && brand.google_trends_trend_pct !== undefined && (
                  <span className={`text-xs font-medium ${brand.google_trends_trend_pct > 0 ? "text-emerald-600" : brand.google_trends_trend_pct < 0 ? "text-rose-600" : "text-mk-sec"}`}>
                    {brand.google_trends_trend_pct > 0 ? "↗" : brand.google_trends_trend_pct < 0 ? "↘" : "→"} {brand.google_trends_trend_pct > 0 ? "+" : ""}{brand.google_trends_trend_pct.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <DataRow label="Référencement officinal estimé" tooltip="Part estimée des pharmacies belges référençant la marque. Sources : études partenaires.">
              {brand.officinal_coverage_pct !== null ? `${Math.round(brand.officinal_coverage_pct)}% des pharmacies BE` : <span className="text-xs text-mk-ter">Donnée non disponible</span>}
            </DataRow>
            <DataRow label="Mentions presse pro (12 mois)" tooltip="Source : revue de presse Le Pharmacien & Journal du Pharmacien.">
              {brand.press_mentions_12m !== null ? brand.press_mentions_12m : <span className="text-xs text-mk-ter">—</span>}
            </DataRow>
          </div>
          <Disclaimer>
            Google Trends BE, études partenaires, revue de presse Le Pharmacien & Journal du Pharmacien. Mise à jour mensuelle.
          </Disclaimer>
        </Card>

        {/* ─── Section 4 : Avis pharmaciens vérifiés ──────────────────── */}
        <Card className="p-5">
          <CardHeader icon={Users} color="bg-orange-50 text-orange-700" title="Avis pharmaciens vérifiés" />

          {!enoughReviews ? (
            <div className="p-3 bg-mk-alt rounded-md text-xs text-mk-sec inline-flex items-start gap-2 w-full">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                Pas encore assez d'avis pour afficher une notation fiable
                ({reviews.length} avis collecté{reviews.length > 1 ? "s" : ""}, minimum 5 requis).
                {canReview && (
                  <div className="mt-2">
                    <button
                      onClick={() => setReviewOpen(true)}
                      className="text-xs font-semibold text-mk-blue hover:underline"
                    >
                      + Donner mon avis
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {[
                  ["Qualité", "rating_quality"],
                  ["Livraison", "rating_delivery"],
                  ["Support", "rating_support"],
                  ["Doc.", "rating_documentation"],
                  ["Marge", "rating_margin"],
                ].map(([label, key]) => (
                  <div key={key} className="text-center p-2 bg-mk-alt rounded">
                    <div className="text-xs text-mk-sec">{label}</div>
                    <div className="text-sm font-bold text-mk-navy inline-flex items-center gap-1">
                      <Star size={12} className="text-amber-500" fill="currentColor" />
                      {avg(key as keyof ReviewRow)}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-mk-sec mb-2">{reviews.length} avis · pas de note globale</p>
              <div className="space-y-2">
                {reviews.slice(0, 3).map(r => (
                  <div key={r.id} className="border border-mk-line rounded-md p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-mk-sec mb-1">
                      <span className="font-medium text-mk-navy">{r.reviewer_initials} · {r.reviewer_city ?? "—"}</span>
                      <span>{fmtDate(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="text-xs text-mk-navy">{r.comment}</p>}
                    <p className="text-[10px] text-emerald-700 mt-1">✓ Acheteur vérifié — {r.verified_buyer_orders_count} commande{r.verified_buyer_orders_count > 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
              {canReview && (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
                    + Donner mon avis
                  </Button>
                </div>
              )}
            </>
          )}
          <Disclaimer>Avis liés à des acheteurs vérifiés ayant passé au moins une commande de la marque.</Disclaimer>
        </Card>

        {/* ─── Section 5 : Synthèse ───────────────────────────────────── */}
        <Card className="p-5 md:col-span-2">
          <h3 className="text-base font-bold text-mk-navy mb-3">Synthèse — points forts & à noter</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-emerald-700 mb-2 inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Points forts
              </div>
              {positives.length > 0 ? (
                <ul className="space-y-1.5">
                  {positives.map(p => (
                    <li key={p} className="text-sm text-mk-navy inline-flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span> <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-mk-ter">Aucun point fort calculable avec les données disponibles.</p>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-2 inline-flex items-center gap-1.5">
                <AlertTriangle size={14} /> À noter
              </div>
              {watch.length > 0 ? (
                <ul className="space-y-1.5">
                  {watch.map(p => (
                    <li key={p} className="text-sm text-mk-navy inline-flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">⚠</span> <span>{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-mk-ter">Aucun point d'attention spécifique.</p>
              )}
            </div>
          </div>
          <Disclaimer>
            Bullets calculés automatiquement à partir des données factuelles ci-dessus — aucune saisie manuelle.
          </Disclaimer>
        </Card>
      </div>
    </TooltipProvider>
  );
}
