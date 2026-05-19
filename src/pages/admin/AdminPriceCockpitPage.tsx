import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Send, Zap, ExternalLink, AlertTriangle, TrendingDown, Package, Users } from "lucide-react";
import PriceChallengeModal, { type ChallengeContext } from "@/components/admin/PriceChallengeModal";
import { Helmet } from "react-helmet-async";

interface CockpitRow {
  product_id: string;
  product_name: string;
  cnk: string | null;
  brand_name: string | null;
  brand_id: string | null;
  category_id: string | null;
  mk_best_ht: number | null;
  mk_best_offer_id: string | null;
  mk_best_vendor_id: string | null;
  mk_best_vendor_name: string | null;
  mk_offers_count: number;
  mk_2nd_ht: number | null;
  external_best_ht: number | null;
  external_best_source: string | null;
  external_best_url: string | null;
  market_pharm_ht: number | null;
  market_grossiste_ht: number | null;
  market_public_ht: number | null;
  pvp_ttc: number | null;
  delta_vs_external_pct: number | null;
  delta_vs_internal_pct: number | null;
  worst_action_score: number | null;
}

interface Kpis {
  mk_higher_than_external: number;
  mk_higher_internal: number;
  active_products_total: number;
  active_products_without_offer: number;
  avg_delta_vs_external_pct: number | null;
}

interface GapRow {
  product_id: string;
  product_name: string;
  cnk: string | null;
  brand_name: string | null;
  brand_id: string | null;
  external_best_ht: number | null;
  external_offers_count: number;
  pvp_ttc: number | null;
  popularity: number | null;
  rfq_count_90d: number;
  rfq_total_qty_90d: number;
  last_rfq_at: string | null;
  priority_score: number | null;
}

type GapSortKey = "priority" | "rfq_count" | "popularity" | "name";

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2)} €`;

type SortKey = "action_score" | "delta_external" | "delta_internal";

export default function AdminPriceCockpitPage() {
  const [country, setCountry] = useState<string>("BE");
  const [minDelta, setMinDelta] = useState<string>("0");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("action_score");
  const [challenge, setChallenge] = useState<ChallengeContext | null>(null);
  const [quickSend, setQuickSend] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Gaps tab filters
  const [gapSearch, setGapSearch] = useState("");
  const [gapMinRfq, setGapMinRfq] = useState<string>("0");
  const [gapOnlyDemand, setGapOnlyDemand] = useState<boolean>(true);
  const [gapSortBy, setGapSortBy] = useState<GapSortKey>("priority");

  const kpisQ = useQuery({
    queryKey: ["price-cockpit-kpis", country],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_price_cockpit_kpis", {
        _country: country || null,
      });
      if (error) throw error;
      return data as unknown as Kpis;
    },
  });

  const rowsQ = useQuery({
    queryKey: ["price-cockpit-rows", country, minDelta],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_price_cockpit_rows", {
        _country: country || null,
        _brand_id: null,
        _category_id: null,
        _min_delta_pct: minDelta ? Number(minDelta) : null,
        _only_mk_higher: true,
        _limit: 300,
        _offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as CockpitRow[];
    },
  });

  const gapsQ = useQuery({
    queryKey: ["price-cockpit-gaps-v2", country, gapSearch, gapMinRfq, gapOnlyDemand],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_price_cockpit_gaps_v2", {
        _country: country || null,
        _brand_id: null,
        _search: gapSearch.trim() || null,
        _min_rfq_count: gapMinRfq ? Number(gapMinRfq) : 0,
        _only_with_demand: gapOnlyDemand,
        _limit: 300,
      });
      if (error) throw error;
      return (data ?? []) as GapRow[];
    },
  });

  const metricsQ = useQuery({
    queryKey: ["price-challenge-metrics"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_price_challenge_metrics_v")
        .select("*")
        .order("total_challenges", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        vendor_id: string;
        vendor_name: string | null;
        total_challenges: number;
        responded_count: number;
        response_rate_pct: number | null;
        avg_response_delta_pct: number | null;
        avg_response_days: number | null;
        last_sent_at: string | null;
        last_open_challenge_at: string | null;
        sent_30d: number;
        responded_30d: number;
      }>;
    },
  });

  const sortedGaps = useMemo(() => {
    const rows = gapsQ.data ?? [];
    const get = (r: GapRow) => {
      if (gapSortBy === "rfq_count") return r.rfq_count_90d ?? 0;
      if (gapSortBy === "popularity") return r.popularity ?? 0;
      if (gapSortBy === "name") return 0;
      return r.priority_score ?? 0;
    };
    if (gapSortBy === "name") {
      return [...rows].sort((a, b) => (a.product_name ?? "").localeCompare(b.product_name ?? ""));
    }
    return [...rows].sort((a, b) => get(b) - get(a));
  }, [gapsQ.data, gapSortBy]);

  const filteredRows = useMemo(() => {
    if (!rowsQ.data) return [];
    const s = search.trim().toLowerCase();
    const base = !s
      ? rowsQ.data
      : rowsQ.data.filter(
          (r) =>
            r.product_name?.toLowerCase().includes(s) ||
            r.brand_name?.toLowerCase().includes(s) ||
            r.cnk?.toLowerCase().includes(s) ||
            r.mk_best_vendor_name?.toLowerCase().includes(s),
        );
    const sortFn = (a: CockpitRow, b: CockpitRow) => {
      const get = (r: CockpitRow) => {
        if (sortBy === "delta_external") return r.delta_vs_external_pct ?? -Infinity;
        if (sortBy === "delta_internal") return r.delta_vs_internal_pct ?? -Infinity;
        return r.worst_action_score ?? -Infinity;
      };
      return get(b) - get(a);
    };
    return [...base].sort(sortFn);
  }, [rowsQ.data, search, sortBy]);

  function openChallenge(row: CockpitRow, mode: "quick" | "edit") {
    if (!row.mk_best_vendor_id || !row.mk_best_ht) return;
    // Choisir la meilleure référence disponible
    const candidates: Array<{ price: number; label: string; reason: ChallengeContext["reason"] }> = [];
    if (row.external_best_ht && row.external_best_ht > 0)
      candidates.push({ price: row.external_best_ht, label: row.external_best_source ?? "marché externe", reason: "vs_external" });
    if (row.mk_2nd_ht && row.mk_2nd_ht > 0)
      candidates.push({ price: row.mk_2nd_ht, label: "2e meilleur vendeur MK", reason: "vs_internal" });
    if (row.market_pharm_ht && row.market_pharm_ht > 0)
      candidates.push({ price: row.market_pharm_ht, label: "prix pharmacien", reason: "vs_external" });
    const best = candidates.sort((a, b) => a.price - b.price)[0];
    if (!best) return;
    const deltaPct = ((row.mk_best_ht - best.price) / best.price) * 100;
    setChallenge({
      vendorId: row.mk_best_vendor_id,
      vendorDisplayName: row.mk_best_vendor_name ?? "Vendeur",
      productId: row.product_id,
      productName: row.product_name,
      offerId: row.mk_best_offer_id,
      mkPriceHt: row.mk_best_ht,
      refPriceHt: best.price,
      refLabel: best.label,
      reason: best.reason,
      deltaPct,
    });
    setQuickSend(mode === "quick");
    setModalOpen(true);
  }

  const k = kpisQ.data;

  return (
    <div className="space-y-6">
      <Helmet><title>Cockpit prix · Admin MediKong</title></Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cockpit prix</h1>
          <p className="text-sm text-muted-foreground">
            Détectez où MediKong est plus cher que le marché et challengez les vendeurs en 1 clic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="country" className="text-sm">Pays</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="country" className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BE">BE</SelectItem>
              <SelectItem value="FR">FR</SelectItem>
              <SelectItem value="LU">LU</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="MK plus cher que le marché externe"
          value={k?.mk_higher_than_external ?? "—"}
          loading={kpisQ.isLoading}
          color="text-red-600"
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="MK plus cher qu'un autre vendeur MK"
          value={k?.mk_higher_internal ?? "—"}
          loading={kpisQ.isLoading}
          color="text-orange-600"
        />
        <KpiCard
          icon={<Package className="w-4 h-4" />}
          label="Produits actifs sans offre"
          value={k?.active_products_without_offer ?? "—"}
          loading={kpisQ.isLoading}
          color="text-amber-600"
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Écart moyen vs marché externe"
          value={k?.avg_delta_vs_external_pct != null ? `${k.avg_delta_vs_external_pct > 0 ? "+" : ""}${k.avg_delta_vs_external_pct}%` : "—"}
          loading={kpisQ.isLoading}
        />
        <KpiCard
          icon={<Package className="w-4 h-4" />}
          label="Produits actifs (total)"
          value={k?.active_products_total ?? "—"}
          loading={kpisQ.isLoading}
        />
      </div>

      <Tabs defaultValue="overpriced">
        <TabsList>
          <TabsTrigger value="overpriced">Offres à challenger</TabsTrigger>
          <TabsTrigger value="gaps">Trous catalogue ({gapsQ.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="metrics">Métriques challenges</TabsTrigger>
        </TabsList>

        <TabsContent value="overpriced" className="space-y-3">
          {/* Filtres */}
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <Label>Recherche (produit / marque / CNK / vendeur)</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex : doliprane, Pharmamed…" />
              </div>
              <div>
                <Label>Écart minimum vs marché (%)</Label>
                <Input
                  type="number"
                  step="1"
                  className="w-32"
                  value={minDelta}
                  onChange={(e) => setMinDelta(e.target.value)}
                />
              </div>
              <div>
                <Label>Trier par</Label>
                <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action_score">Potentiel d'action (défaut)</SelectItem>
                    <SelectItem value="delta_external">Écart externe (%)</SelectItem>
                    <SelectItem value="delta_internal">Écart interne (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground ml-auto">
                {rowsQ.isLoading ? "Chargement…" : `${filteredRows.length} ligne${filteredRows.length > 1 ? "s" : ""}`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">MK best HT</TableHead>
                    <TableHead className="text-right">Externe HT</TableHead>
                    <TableHead className="text-right">Écart externe</TableHead>
                    <TableHead className="text-right">2e MK</TableHead>
                    <TableHead className="text-right">Écart interne</TableHead>
                    <TableHead>Vendeur #1</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsQ.isLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
                  )}
                  {!rowsQ.isLoading && filteredRows.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune offre à challenger 🎉</TableCell></TableRow>
                  )}
                  {filteredRows.map((r) => (
                    <TableRow key={r.product_id}>
                      <TableCell className="max-w-xs">
                        <Link to={`/admin/produits/${r.product_id}`} className="font-medium text-mk-blue hover:underline line-clamp-2">
                          {r.product_name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {r.brand_name ?? "—"} {r.cnk ? `· CNK ${r.cnk}` : ""} · {r.mk_offers_count} offre{r.mk_offers_count > 1 ? "s" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.worst_action_score != null ? (
                          <Badge
                            variant={
                              r.worst_action_score >= 50 ? "destructive"
                                : r.worst_action_score >= 20 ? "secondary"
                                : "outline"
                            }
                            title="Potentiel d'action : combine écart externe, écart interne et activité du produit"
                          >
                            {Math.round(r.worst_action_score)}
                          </Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.mk_best_ht)}</TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono">{fmt(r.external_best_ht)}</div>
                        {r.external_best_source && (
                          <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            {r.external_best_source}
                            {r.external_best_url && (
                              <a href={r.external_best_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.delta_vs_external_pct != null ? (
                          <Badge variant={r.delta_vs_external_pct > 5 ? "destructive" : "secondary"}>
                            {r.delta_vs_external_pct > 0 ? "+" : ""}{r.delta_vs_external_pct}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.mk_2nd_ht)}</TableCell>
                      <TableCell className="text-right">
                        {r.delta_vs_internal_pct != null ? (
                          <Badge variant={r.delta_vs_internal_pct > 0 ? "destructive" : "outline"}>
                            {r.delta_vs_internal_pct > 0 ? "+" : ""}{r.delta_vs_internal_pct}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.mk_best_vendor_id ? (
                          <Link to={`/admin/vendeurs/${r.mk_best_vendor_id}`} className="hover:underline">
                            {r.mk_best_vendor_name}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="default" onClick={() => openChallenge(r, "quick")}>
                            <Zap className="w-3 h-3 mr-1" /> Envoi rapide
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openChallenge(r, "edit")}>
                            <Send className="w-3 h-3 mr-1" /> Personnaliser
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-3">
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <Label>Recherche (produit / marque / CNK)</Label>
                <Input value={gapSearch} onChange={(e) => setGapSearch(e.target.value)} placeholder="Ex : doliprane, Pharmamed…" />
              </div>
              <div>
                <Label>RFQ minimum (90j)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  className="w-28"
                  value={gapMinRfq}
                  onChange={(e) => setGapMinRfq(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <input
                  id="only-demand"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={gapOnlyDemand}
                  onChange={(e) => setGapOnlyDemand(e.target.checked)}
                />
                <Label htmlFor="only-demand" className="text-sm">Uniquement avec demande (RFQ)</Label>
              </div>
              <div>
                <Label>Trier par</Label>
                <Select value={gapSortBy} onValueChange={(v: GapSortKey) => setGapSortBy(v)}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priorité (défaut)</SelectItem>
                    <SelectItem value="rfq_count">Nombre de RFQ</SelectItem>
                    <SelectItem value="popularity">Popularité produit</SelectItem>
                    <SelectItem value="name">Nom (A→Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground ml-auto">
                {gapsQ.isLoading ? "Chargement…" : `${sortedGaps.length} produit${sortedGaps.length > 1 ? "s" : ""}`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Priorité</TableHead>
                    <TableHead className="text-right">RFQ 90j</TableHead>
                    <TableHead className="text-right">Qté demandée</TableHead>
                    <TableHead className="text-right">Dernière RFQ</TableHead>
                    <TableHead className="text-right">Popularité</TableHead>
                    <TableHead className="text-right">Offres ext.</TableHead>
                    <TableHead className="text-right">Meilleur ext. HT</TableHead>
                    <TableHead className="text-right">PVP TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gapsQ.isLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
                  )}
                  {!gapsQ.isLoading && sortedGaps.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun trou catalogue détecté 🎉</TableCell></TableRow>
                  )}
                  {sortedGaps.map((g) => {
                    const score = g.priority_score ?? 0;
                    const lastRfq = g.last_rfq_at ? new Date(g.last_rfq_at) : null;
                    return (
                      <TableRow key={g.product_id}>
                        <TableCell className="max-w-xs">
                          <Link to={`/admin/produits/${g.product_id}`} className="font-medium text-mk-blue hover:underline line-clamp-2">
                            {g.product_name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {g.brand_name ?? "—"}{g.cnk ? ` · CNK ${g.cnk}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={score >= 50 ? "destructive" : score >= 20 ? "secondary" : "outline"}
                            title="Priorité = RFQ × 10 + popularité × 0.5 + bonus dispo externe + bonus RFQ récente (14j)"
                          >
                            {Math.round(score)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{g.rfq_count_90d}</TableCell>
                        <TableCell className="text-right font-mono">{g.rfq_total_qty_90d || "—"}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {lastRfq ? lastRfq.toLocaleDateString("fr-BE", { day: "2-digit", month: "short" }) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {g.popularity != null ? Math.round(g.popularity) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">{g.external_offers_count || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(g.external_best_ht)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(g.pvp_ttc)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-3">
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              Métriques par vendeur basées sur l'historique des challenges. Un challenge est considéré « répondu »
              quand le vendeur baisse son prix HTVA dans les 30 jours suivants.
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendeur</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Répondus</TableHead>
                    <TableHead className="text-right">Taux réponse</TableHead>
                    <TableHead className="text-right">Δ moyen réponse</TableHead>
                    <TableHead className="text-right">Délai moyen</TableHead>
                    <TableHead className="text-right">30j (env / rép)</TableHead>
                    <TableHead className="text-right">Dernier envoi</TableHead>
                    <TableHead className="text-right">Dernier ouvert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricsQ.isLoading && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
                  )}
                  {!metricsQ.isLoading && (metricsQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun challenge envoyé pour l'instant.</TableCell></TableRow>
                  )}
                  {(metricsQ.data ?? []).map((m) => {
                    const rate = m.response_rate_pct ?? 0;
                    return (
                      <TableRow key={m.vendor_id}>
                        <TableCell>
                          <Link to={`/admin/vendeurs/${m.vendor_id}`} className="font-medium text-mk-blue hover:underline">
                            {m.vendor_name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-mono">{m.total_challenges}</TableCell>
                        <TableCell className="text-right font-mono">{m.responded_count}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={rate >= 50 ? "default" : rate >= 20 ? "secondary" : "outline"}
                            title="% de challenges suivis d'une baisse de prix dans les 30j"
                          >
                            {m.response_rate_pct != null ? `${m.response_rate_pct}%` : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.avg_response_delta_pct != null ? `${m.avg_response_delta_pct}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.avg_response_days != null ? `${m.avg_response_days}j` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {m.sent_30d} / {m.responded_30d}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {m.last_sent_at ? new Date(m.last_sent_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "short" }) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {m.last_open_challenge_at ? new Date(m.last_open_challenge_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "short" }) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PriceChallengeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        ctx={challenge}
        quickSend={quickSend}
        onSent={() => { rowsQ.refetch(); kpisQ.refetch(); }}
      />
    </div>
  );
}

function KpiCard({
  icon, label, value, loading, color,
}: { icon: React.ReactNode; label: string; value: number | string; loading?: boolean; color?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color ?? ""}`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}
