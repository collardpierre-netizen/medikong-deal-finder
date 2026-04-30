import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Download, ChevronRight, Award, Loader2, Clock, Inbox } from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";
import { BuyerRfqTracker } from "@/components/rfq/BuyerRfqTracker";

type RfqRow = {
  id: string;
  product_id: string | null;
  brand_id: string | null;
  target_scope: string;
  quantity: number;
  target_price_excl_vat_cents: number | null;
  desired_delivery_date: string | null;
  destination_country_code: string;
  status: string;
  responses_deadline: string | null;
  dispatched_at: string | null;
  created_at: string;
  closed_at: string | null;
  comment: string | null;
  payment_terms: string | null;
  required_offer_validity_days: number | null;
};

type ResponseRow = {
  id: string;
  rfq_id: string;
  vendor_id: string;
  unit_price_excl_vat_cents: number;
  moq: number | null;
  delivery_days: number | null;
  offer_validity_days: number | null;
  payment_terms: string | null;
  comment: string | null;
  rank_position: number | null;
  is_visible_to_buyer: boolean;
  awarded: boolean;
  created_at: string;
  score: number | null;
  score_price: number | null;
  score_delivery: number | null;
  score_compliance: number | null;
  score_availability: number | null;
  is_top_pick: boolean;
  compliance_flags: { moq_ok?: boolean; validity_ok?: boolean; beats_target_price?: boolean; admin_curated?: boolean } | null;
  vendor?: { id: string; name: string | null; slug: string | null } | null;
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Brouillon", variant: "outline" },
  open: { label: "En collecte", variant: "default" },
  dispatched: { label: "Envoyée", variant: "secondary" },
  in_followup: { label: "En relance", variant: "default" },
  closed: { label: "Clôturée", variant: "outline" },
  awarded: { label: "Attribuée", variant: "default" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

const ACTIVE_STATUSES = new Set(["draft", "open", "dispatched", "in_followup"]);

function formatPrice(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("fr-BE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

export default function MesRfqPage() {
  const { user, isVerifiedBuyer } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rfqs, isLoading } = useQuery({
    queryKey: ["my-rfqs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfqs")
        .select("id, product_id, brand_id, target_scope, quantity, target_price_excl_vat_cents, desired_delivery_date, destination_country_code, status, responses_deadline, dispatched_at, created_at, closed_at, comment, payment_terms, required_offer_validity_days")
        .eq("buyer_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RfqRow[];
    },
    enabled: !!user,
  });

  const productIds = useMemo(() => Array.from(new Set((rfqs || []).map(r => r.product_id).filter(Boolean) as string[])), [rfqs]);
  const brandIds = useMemo(() => Array.from(new Set((rfqs || []).map(r => r.brand_id).filter(Boolean) as string[])), [rfqs]);

  const { data: products } = useQuery({
    queryKey: ["my-rfqs-products", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, slug").in("id", productIds);
      return data || [];
    },
  });
  const { data: brands } = useQuery({
    queryKey: ["my-rfqs-brands", brandIds],
    enabled: brandIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name, slug").in("id", brandIds);
      return data || [];
    },
  });

  const productMap = useMemo(() => Object.fromEntries((products || []).map((p: any) => [p.id, p])), [products]);
  const brandMap = useMemo(() => Object.fromEntries((brands || []).map((b: any) => [b.id, b])), [brands]);

  // Counts of responses per RFQ
  const { data: counts } = useQuery({
    queryKey: ["my-rfqs-counts", rfqs?.map(r => r.id).join(",")],
    enabled: !!rfqs && rfqs.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("rfq_responses")
        .select("rfq_id, unit_price_excl_vat_cents, is_visible_to_buyer, awarded, score, is_top_pick")
        .in("rfq_id", rfqs!.map(r => r.id))
        .eq("is_visible_to_buyer", true);
      const map: Record<string, { count: number; best: number | null; awarded: boolean; topScore: number | null }> = {};
      for (const r of (data || []) as any[]) {
        const c = map[r.rfq_id] ||= { count: 0, best: null, awarded: false, topScore: null };
        c.count += 1;
        if (c.best == null || r.unit_price_excl_vat_cents < c.best) c.best = r.unit_price_excl_vat_cents;
        if (r.awarded) c.awarded = true;
        if (r.is_top_pick && r.score != null) c.topScore = r.score;
      }
      return map;
    },
  });

  if (!user) {
    return (
      <div className="container mx-auto py-12 max-w-2xl text-center">
        <p className="text-muted-foreground">Connectez-vous pour consulter vos demandes de prix.</p>
        <Link to="/connexion"><Button className="mt-4">Se connecter</Button></Link>
      </div>
    );
  }

  if (!isVerifiedBuyer) {
    return (
      <div className="container mx-auto py-12 max-w-2xl text-center">
        <p className="text-muted-foreground">Votre compte doit être vérifié pour utiliser le module Demande de prix.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Mes demandes de prix · MediKong</title></Helmet>
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="h-6 w-6 text-primary" /> Mes demandes de prix</h1>
            <p className="text-sm text-muted-foreground mt-1">Suivi des RFQ envoyées et des meilleures offres reçues.</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        )}

        {!isLoading && (rfqs?.length ?? 0) === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium">Aucune demande de prix</p>
              <p className="text-sm text-muted-foreground mt-1">Lancez une demande depuis n'importe quelle fiche produit.</p>
              <Link to="/catalogue"><Button variant="outline" size="sm" className="mt-4">Explorer le catalogue</Button></Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {(rfqs || []).map(rfq => {
            const prod = rfq.product_id ? productMap[rfq.product_id] : null;
            const brand = rfq.brand_id ? brandMap[rfq.brand_id] : null;
            const c = counts?.[rfq.id];
            const status = STATUS_LABEL[rfq.status] || { label: rfq.status, variant: "outline" as const };
            const isOpen = expanded === rfq.id;

            return (
              <Card key={rfq.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {c?.awarded && <Badge variant="default" className="bg-emerald-600"><Award className="h-3 w-3 mr-1" /> Attribuée</Badge>}
                        {rfq.responses_deadline && ACTIVE_STATUSES.has(rfq.status) && (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Clôture {formatUpdatedAt(rfq.responses_deadline)}
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base mt-2">
                        {prod ? (
                          <Link to={`/produit/${prod.slug}`} className="hover:underline">{prod.name}</Link>
                        ) : brand ? (
                          <Link to={`/marques/${brand.slug}`} className="hover:underline">Marque · {brand.name}</Link>
                        ) : (
                          "Demande de prix"
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Qté <strong>{rfq.quantity.toLocaleString("fr-BE")}</strong> · livraison <strong>{rfq.destination_country_code}</strong>
                        {rfq.target_price_excl_vat_cents != null && <> · cible <strong>{formatPrice(rfq.target_price_excl_vat_cents)}</strong>/u.</>}
                        {rfq.desired_delivery_date && <> · pour le <strong>{formatUpdatedAt(rfq.desired_delivery_date)}</strong></>}
                        <> · créée le {formatUpdatedAt(rfq.created_at)}</>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Offres reçues</p>
                      <p className="text-2xl font-bold leading-none">{c?.count ?? 0}</p>
                      {c?.best != null && <p className="text-xs text-emerald-700 font-semibold mt-1">dès {formatPrice(c.best)}/u.</p>}
                      {c?.topScore != null && <p className="text-[10px] text-muted-foreground mt-0.5">Top score {c.topScore.toFixed(0)}/100</p>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(isOpen ? null : rfq.id)}>
                      <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      {isOpen ? "Masquer" : "Voir les offres"}
                    </Button>
                    {(c?.count ?? 0) > 0 && (
                      <ExportRecapButton rfqId={rfq.id} rfqLabel={prod?.name || brand?.name || rfq.id.slice(0, 8)} />
                    )}
                  </div>

                  {isOpen && (
                    <>
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Suivi des fournisseurs ciblés
                        </h4>
                        <p className="text-xs text-muted-foreground">Statut, dates de réponse et raisons d'échec ou de déclin par vendeur.</p>
                        <BuyerRfqTracker rfqId={rfq.id} />
                      </div>
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold mb-2">Offres reçues</h4>
                        <RfqResponsesPanel rfqId={rfq.id} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ScoreBar({ value, label }: { value: number | null; label: string }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-1.5 min-w-[90px]" title={`${label} : ${v.toFixed(0)}/100`}>
      <span className="text-[10px] text-muted-foreground w-12 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function RfqResponsesPanel({ rfqId }: { rfqId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rfq-responses", rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfq_responses")
        .select("id, rfq_id, vendor_id, unit_price_excl_vat_cents, moq, delivery_days, offer_validity_days, payment_terms, comment, rank_position, is_visible_to_buyer, awarded, created_at, score, score_price, score_delivery, score_compliance, score_availability, is_top_pick, compliance_flags, vendor:vendors!inner(id, name, slug)")
        .eq("rfq_id", rfqId)
        .eq("is_visible_to_buyer", true)
        .order("score", { ascending: false, nullsFirst: false })
        .order("rank_position", { ascending: true, nullsFirst: false })
        .order("unit_price_excl_vat_cents", { ascending: true });
      if (error) throw error;
      return (data || []) as ResponseRow[];
    },
  });

  if (isLoading) return <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Chargement des offres…</div>;
  if (!data || data.length === 0) return <p className="mt-3 text-sm text-muted-foreground italic">Aucune offre reçue pour le moment. Relances et clôture automatiques.</p>;

  const top = data.find(r => r.is_top_pick) || data[0];

  return (
    <div className="mt-3 space-y-3">
      {top && (
        <div className="border-2 border-emerald-300 bg-emerald-50/60 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-700" />
              <span className="font-semibold text-emerald-800">Meilleure offre recommandée</span>
              {top.score != null && <Badge className="bg-emerald-600">Score {top.score.toFixed(0)}/100</Badge>}
            </div>
            <span className="text-sm font-bold">{formatPrice(top.unit_price_excl_vat_cents)}/u.</span>
          </div>
          <p className="text-sm">
            {top.vendor?.slug ? <Link to={`/vendeur/${top.vendor.slug}`} className="font-semibold hover:underline">{top.vendor.name}</Link> : top.vendor?.name}
            {top.delivery_days && <span className="text-muted-foreground"> · livraison {top.delivery_days} j</span>}
            {top.moq && <span className="text-muted-foreground"> · MOQ {top.moq}</span>}
            {top.offer_validity_days && <span className="text-muted-foreground"> · validité {top.offer_validity_days} j</span>}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <ScoreBar value={top.score_price} label="Prix" />
            <ScoreBar value={top.score_delivery != null ? top.score_delivery * 4 : null} label="Délai" />
            <ScoreBar value={top.score_compliance != null ? (top.score_compliance / 15) * 100 : null} label="Conform." />
            <ScoreBar value={top.score_availability != null ? top.score_availability * 10 : null} label="Dispo." />
          </div>
          {top.compliance_flags && (
            <div className="flex flex-wrap gap-1 mt-2 text-[10px]">
              {top.compliance_flags.beats_target_price && <Badge variant="outline" className="border-emerald-400 text-emerald-700">≤ prix cible</Badge>}
              {top.compliance_flags.moq_ok === false && <Badge variant="destructive">MOQ &gt; quantité</Badge>}
              {top.compliance_flags.validity_ok === false && <Badge variant="outline" className="border-amber-400 text-amber-700">Validité insuffisante</Badge>}
              {top.compliance_flags.admin_curated && <Badge variant="outline">Curé MediKong</Badge>}
            </div>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Rang</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Fournisseur</th>
              <th className="px-3 py-2 text-right">Prix HTVA</th>
              <th className="px-3 py-2 text-right">MOQ</th>
              <th className="px-3 py-2 text-right">Délai</th>
              <th className="px-3 py-2 text-left">Conditions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} className={`border-t ${r.is_top_pick ? "bg-emerald-50/40" : ""}`}>
                <td className="px-3 py-2">
                  {r.awarded ? <Badge className="bg-emerald-600"><Award className="h-3 w-3 mr-1" />Choisie</Badge> : <span className="font-semibold">#{r.rank_position ?? i + 1}</span>}
                </td>
                <td className="px-3 py-2">
                  {r.score != null ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{r.score.toFixed(0)}</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${r.score}%` }} />
                      </div>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.vendor?.slug ? <Link to={`/vendeur/${r.vendor.slug}`} className="hover:underline">{r.vendor.name}</Link> : (r.vendor?.name || "—")}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatPrice(r.unit_price_excl_vat_cents)}/u.</td>
                <td className="px-3 py-2 text-right">
                  {r.moq ?? "—"}
                  {r.compliance_flags?.moq_ok === false && <span className="ml-1 text-destructive" title="MOQ supérieur à la quantité demandée">⚠</span>}
                </td>
                <td className="px-3 py-2 text-right">{r.delivery_days ? `${r.delivery_days} j` : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.payment_terms && <span>{r.payment_terms}</span>}
                  {r.offer_validity_days && <span className="ml-2">· valide {r.offer_validity_days} j</span>}
                  {r.comment && <p className="mt-1 italic">{r.comment}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExportRecapButton({ rfqId, rfqLabel }: { rfqId: string; rfqLabel: string }) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("rfq_responses")
        .select("unit_price_excl_vat_cents, moq, delivery_days, offer_validity_days, payment_terms, comment, rank_position, awarded, created_at, score, score_price, score_delivery, score_compliance, score_availability, is_top_pick, vendor:vendors!inner(name)")
        .eq("rfq_id", rfqId)
        .eq("is_visible_to_buyer", true)
        .order("score", { ascending: false, nullsFirst: false })
        .order("rank_position", { ascending: true, nullsFirst: false });
      if (error) throw error;

      const headers = ["Rang", "Top pick", "Score global", "Score prix", "Score délai", "Score conformité", "Score dispo.", "Fournisseur", "Prix HTVA (EUR/u.)", "MOQ", "Délai (j)", "Validité (j)", "Conditions paiement", "Commentaire", "Attribuée", "Reçue le"];
      const rows = (data || []).map((r: any, i: number) => [
        r.awarded ? "ATTRIBUÉE" : (r.rank_position ?? i + 1),
        r.is_top_pick ? "oui" : "",
        r.score != null ? r.score.toFixed(1).replace(".", ",") : "",
        r.score_price != null ? r.score_price.toFixed(1).replace(".", ",") : "",
        r.score_delivery != null ? r.score_delivery.toFixed(1).replace(".", ",") : "",
        r.score_compliance != null ? r.score_compliance.toFixed(1).replace(".", ",") : "",
        r.score_availability != null ? r.score_availability.toFixed(1).replace(".", ",") : "",
        r.vendor?.name || "",
        (r.unit_price_excl_vat_cents / 100).toFixed(2).replace(".", ","),
        r.moq ?? "",
        r.delivery_days ?? "",
        r.offer_validity_days ?? "",
        r.payment_terms || "",
        (r.comment || "").replace(/\r?\n/g, " "),
        r.awarded ? "oui" : "non",
        new Date(r.created_at).toLocaleString("fr-BE"),
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => {
          const s = String(cell ?? "");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(";"))
        .join("\n");

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rfq-${rfqLabel.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}-${rfqId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={busy}>
      {busy ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Download className="h-3 w-3 mr-2" />}
      Récap CSV
    </Button>
  );
}
