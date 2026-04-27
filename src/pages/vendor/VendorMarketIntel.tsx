import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Input } from "@/components/ui/input";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart3,
  Search,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trophy,
  ExternalLink,
  Globe,
  Store,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Clock,
  Wand2,
} from "lucide-react";
import { AdjustPriceModal, type AdjustPriceContext } from "@/components/vendor/AdjustPriceModal";
import { MarginInsightCard } from "@/components/vendor/MarginInsightCard";
import { MarginBreakdownDetails } from "@/components/vendor/MarginBreakdownDetails";
import { useVendorCommissionConfig } from "@/hooks/useVendorCommissionConfig";
import { computeMargin, fmtEur } from "@/lib/vendorMargin";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface MedikongOffer {
  offer_id: string;
  vendor_id: string;
  vendor_name: string;
  price_excl_vat: number;
  stock_quantity: number;
  stock_status: string | null;
  is_promo: boolean;
  promo_discount: number | null;
  delivery_days: number | null;
  updated_at: string | null;
  is_mine: boolean;
}

interface ExternalOffer {
  source_id: string;
  source_name: string;
  prix_pharmacien: number | null;
  prix_grossiste: number | null;
  prix_public: number | null;
  tva_rate: number | null;
  product_url: string | null;
  stock_source: string | null;
  imported_at: string | null;
}

interface IntelRow {
  product_id: string;
  product_name: string;
  product_image: string | null;
  gtin: string | null;
  cnk_code: string | null;
  brand_name: string | null;
  country_code: string;
  product_discount_percentage: number | null;
  my_offer_id: string;
  my_price_excl_vat: number;
  my_stock: number;
  my_stock_status: string | null;
  my_updated_at: string | null;
  my_rank: number;
  medikong_competitors_count: number;
  medikong_total_offers: number;
  best_medikong_competitor_price: number | null;
  best_medikong_competitor_vendor: string | null;
  medikong_median_price: number | null;
  gap_vs_best_amount: number | null;
  gap_vs_best_percentage: number | null;
  gap_vs_median_amount: number | null;
  gap_vs_median_percentage: number | null;
  external_sources_count: number;
  best_external_price: number | null;
  best_external_source: string | null;
  competitors_in_stock: number;
  competitors_on_promo: number;
  medikong_offers: MedikongOffer[];
  external_offers: ExternalOffer[];
}

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toFixed(2)} €` : "—";

type SortKey =
  | "product_name"
  | "my_price_excl_vat"
  | "my_rank"
  | "medikong_competitors_count"
  | "best_medikong_competitor_price"
  | "external_sources_count"
  | "best_external_price"
  | "availability";

type SortDir = "asc" | "desc";

/**
 * Score de disponibilité : plus la valeur est élevée, mieux c'est.
 * Utilisé pour le tri de la colonne "Mon statut".
 *  4 = En stock + Promo
 *  3 = En stock
 *  2 = Stock bas
 *  1 = Rupture
 */
function availabilityScore(r: {
  my_stock: number;
  my_stock_status: string | null;
  product_discount_percentage: number | null;
}): number {
  const q = r.my_stock ?? 0;
  const s = (r.my_stock_status || "").toLowerCase();
  const promo = (r.product_discount_percentage ?? 0) > 0;
  if (q <= 0 || s === "out_of_stock") return 1;
  if (s === "low_stock" || (q > 0 && q < 10)) return 2;
  return promo ? 4 : 3;
}

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1)
    return (
      <VBadge color="#16A34A" bg="#DCFCE7">
        <Trophy size={11} className="inline -mt-0.5 mr-1" />#1 / {total}
      </VBadge>
    );
  if (rank === 2)
    return (
      <VBadge color="#CA8A04" bg="#FEF3C7">
        #{rank} / {total}
      </VBadge>
    );
  return (
    <VBadge color="#DC2626" bg="#FEE2E2">
      #{rank} / {total}
    </VBadge>
  );
}

function StockBadge({
  qty,
  status,
}: {
  qty: number | null | undefined;
  status: string | null | undefined;
}) {
  const q = qty ?? 0;
  const s = (status || "").toLowerCase();
  if (q <= 0 || s === "out_of_stock") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
        <XCircle size={11} /> Rupture
      </span>
    );
  }
  if (s === "low_stock" || (q > 0 && q < 10)) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
        <AlertCircle size={11} /> Stock bas ({q})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
      <CheckCircle2 size={11} /> En stock ({q})
    </span>
  );
}

function PromoBadge({ discount }: { discount: number | null | undefined }) {
  if (!discount || discount <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700">
      <Tag size={9} /> -{Math.round(discount)}%
    </span>
  );
}

function FreshnessLabel({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-[10px] text-muted-foreground">—</span>;
  const d = new Date(date);
  const ageDays = (Date.now() - d.getTime()) / 86400000;
  const colorClass =
    ageDays <= 2 ? "text-emerald-600" : ageDays <= 14 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${colorClass}`}>
      <Clock size={9} />
      {formatDistanceToNow(d, { addSuffix: true, locale: fr })}
    </span>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 hover:text-foreground transition-colors w-full ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      <span>{label}</span>
      <Icon size={12} className={active ? "text-foreground" : "text-muted-foreground/50"} />
    </button>
  );
}

type StatusFilter = "all" | "winning" | "losing_mk" | "losing_ext";

const FILTER_STORAGE_KEY = "mk_vendor_market_intel_filters_v1";

interface PersistedFilters {
  search: string;
  ean: string;
  status: StatusFilter;
}

function loadFilters(): PersistedFilters {
  if (typeof window === "undefined")
    return { search: "", ean: "", status: "all" };
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { search: "", ean: "", status: "all" };
    const p = JSON.parse(raw) as Partial<PersistedFilters>;
    return {
      search: typeof p.search === "string" ? p.search : "",
      ean: typeof p.ean === "string" ? p.ean : "",
      status: (["all", "winning", "losing_mk", "losing_ext"] as StatusFilter[]).includes(
        p.status as StatusFilter,
      )
        ? (p.status as StatusFilter)
        : "all",
    };
  } catch {
    return { search: "", ean: "", status: "all" };
  }
}

export default function VendorMarketIntel() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = (vendor as any)?.id;
  const initial = useMemo(loadFilters, []);
  const [search, setSearch] = useState(initial.search);
  const [eanFilter, setEanFilter] = useState(initial.ean);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initial.status);
  const [sortKey, setSortKey] = useState<SortKey>("medikong_competitors_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [openRow, setOpenRow] = useState<IntelRow | null>(null);
  const [adjustCtx, setAdjustCtx] = useState<AdjustPriceContext | null>(null);
  /**
   * Prix HTVA en cours de saisie dans le modal "Ajuster mon prix".
   * Tant que le modal est ouvert et qu'une valeur valide est saisie,
   * le panneau "Mon offre — marge & commission MediKong" et la ligne
   * "(vous)" du tableau MediKong utilisent ce prix au lieu de
   * `openRow.my_price_excl_vat` pour un recalcul instantané.
   */
  const [livePrice, setLivePrice] = useState<number | null>(null);
  /** Horodatage du dernier recalcul live (mis à jour à chaque saisie valide). */
  const [liveRecalcAt, setLiveRecalcAt] = useState<number | null>(null);
  /** Petit flag pour faire pulser le badge "En direct" quelques instants après chaque maj. */
  const [livePulse, setLivePulse] = useState(false);
  useEffect(() => {
    if (livePrice == null) {
      setLiveRecalcAt(null);
      setLivePulse(false);
      return;
    }
    setLiveRecalcAt(Date.now());
    setLivePulse(true);
    const t = setTimeout(() => setLivePulse(false), 900);
    return () => clearTimeout(t);
  }, [livePrice]);

  /**
   * Dernière sauvegarde de prix réussie depuis le modal "Ajuster mon prix",
   * indexée par `offer_id`. Permet d'afficher le comparatif Avant / Après
   * de "Net après commission" dans le panneau "Mon offre" tant que la session
   * de la veille marché reste ouverte.
   */
  const [lastSaves, setLastSaves] = useState<
    Record<string, { oldPrice: number; newPrice: number; savedAt: number }>
  >({});
  // Tri & filtre du tableau "Offres MediKong" dans le détail
  const [mkSortKey, setMkSortKey] = useState<"net" | "price" | null>(null);
  const [mkSortDir, setMkSortDir] = useState<"asc" | "desc">("desc");
  const [mkFilter, setMkFilter] = useState<"all" | "better" | "worse">("all");
  // Reset tri/filtre quand on change de produit
  useEffect(() => {
    setMkSortKey(null);
    setMkSortDir("desc");
    setMkFilter("all");
  }, [openRow?.product_id]);

  // Commission config + purchase price for the currently opened product
  // (used to display MediKong commission and net-in-pocket inside the detail popup)
  const { data: commissionConfig } = useVendorCommissionConfig(vendorId ?? null);
  const { data: openRowPurchasePrice } = useQuery({
    enabled: !!openRow?.my_offer_id && !!vendorId && !!openRow?.product_id,
    queryKey: [
      "vendor-purchase-price",
      openRow?.my_offer_id,
      vendorId,
      openRow?.product_id,
    ],
    queryFn: async (): Promise<number | null> => {
      if (!openRow?.my_offer_id || !vendorId || !openRow?.product_id) return null;
      const [{ data: offer }, { data: dflt }] = await Promise.all([
        supabase
          .from("offers")
          .select("purchase_price_excl_vat")
          .eq("id", openRow.my_offer_id)
          .maybeSingle(),
        supabase
          .from("vendor_product_costs")
          .select("default_purchase_price_excl_vat")
          .eq("vendor_id", vendorId)
          .eq("product_id", openRow.product_id)
          .maybeSingle(),
      ]);
      const o = (offer as any)?.purchase_price_excl_vat;
      if (o != null) return Number(o);
      const d = (dflt as any)?.default_purchase_price_excl_vat;
      if (d != null) return Number(d);
      return null;
    },
  });

  // Persist filters
  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({ search, ean: eanFilter, status: statusFilter }),
      );
    } catch {
      // noop
    }
  }, [search, eanFilter, statusFilter]);

  const { data: rows = [], isLoading, isFetching: isFetchingIntel } = useQuery({
    queryKey: ["vendor-market-intel", vendorId],
    queryFn: async (): Promise<IntelRow[]> => {
      if (!vendorId) return [];
      const { data, error } = await (supabase.rpc as any)("get_vendor_market_intelligence", {
        _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data || []) as IntelRow[];
    },
    enabled: Boolean(vendorId),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ean = eanFilter.trim().toLowerCase();
    let arr = rows;
    if (q) {
      arr = arr.filter(
        (r) =>
          r.product_name?.toLowerCase().includes(q) ||
          r.gtin?.toLowerCase().includes(q) ||
          r.cnk_code?.toLowerCase().includes(q) ||
          r.brand_name?.toLowerCase().includes(q),
      );
    }
    if (ean) {
      arr = arr.filter(
        (r) =>
          r.gtin?.toLowerCase().includes(ean) ||
          r.cnk_code?.toLowerCase().includes(ean),
      );
    }
    if (statusFilter !== "all") {
      arr = arr.filter((r) => {
        if (statusFilter === "winning") return r.my_rank === 1;
        if (statusFilter === "losing_mk")
          return r.my_rank > 1 && (r.medikong_competitors_count ?? 0) > 0;
        if (statusFilter === "losing_ext")
          return (
            r.best_external_price != null &&
            r.best_external_price < r.my_price_excl_vat
          );
        return true;
      });
    }
    const sorted = [...arr].sort((a, b) => {
      if (sortKey === "availability") {
        const va = availabilityScore(a);
        const vb = availabilityScore(b);
        if (va === vb) return 0;
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const va = a[sortKey as keyof IntelRow];
      const vb = b[sortKey as keyof IntelRow];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return sorted;
  }, [rows, search, eanFilter, statusFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "product_name" ? "asc" : "desc");
    }
  };

  const kpis = useMemo(() => {
    const total = rows.length;
    const winning = rows.filter((r) => r.my_rank === 1).length;
    const losingMedikong = rows.filter(
      (r) => r.my_rank > 1 && r.medikong_competitors_count > 0,
    ).length;
    const losingExternal = rows.filter(
      (r) =>
        r.best_external_price != null && r.best_external_price < r.my_price_excl_vat,
    ).length;
    return { total, winning, losingMedikong, losingExternal };
  }, [rows]);

  /**
   * Garde-fou anti "prix obsolète" pour le popup détail.
   *
   * Lorsqu'on ferme et rouvre rapidement la même ligne pendant qu'un refetch
   * de `vendor-market-intel` est en cours, le `openRow` capturé au clic peut
   * porter une valeur de `my_price_excl_vat` antérieure à la dernière
   * sauvegarde locale (le patch chirurgical du cache peut être écrasé par
   * le résultat d'un refetch en vol et la RPC peut être éventuellement
   * cohérente). On combine donc trois sources et on prend la plus récente :
   *   1) le snapshot `openRow` du clic ;
   *   2) la version la plus fraîche du cache live (`rows`) pour ce
   *      `my_offer_id`, comparée via `my_updated_at` ;
   *   3) la dernière sauvegarde réussie en session
   *      (`lastSaves[my_offer_id]`).
   */
  const safeOpenRow = useMemo<IntelRow | null>(() => {
    if (!openRow) return null;
    let row: IntelRow = openRow;
    const liveRow = rows.find(
      (r) => r.my_offer_id && r.my_offer_id === openRow.my_offer_id,
    );
    if (liveRow) {
      const liveTs = liveRow.my_updated_at ? Date.parse(liveRow.my_updated_at) : 0;
      const snapTs = openRow.my_updated_at ? Date.parse(openRow.my_updated_at) : 0;
      if (liveTs >= snapTs) row = liveRow;
    }
    const ls = openRow.my_offer_id ? lastSaves[openRow.my_offer_id] : undefined;
    if (ls) {
      const rowTs = row.my_updated_at ? Date.parse(row.my_updated_at) : 0;
      if (ls.savedAt >= rowTs && row.my_price_excl_vat !== ls.newPrice) {
        row = {
          ...row,
          my_price_excl_vat: ls.newPrice,
          my_updated_at: new Date(ls.savedAt).toISOString(),
        };
      }
    }
    return row;
  }, [openRow, rows, lastSaves]);

  /** True quand le popup affiche un prix forcé par le garde-fou. */
  const openRowGuarded = !!(
    openRow &&
    safeOpenRow &&
    safeOpenRow.my_price_excl_vat !== openRow.my_price_excl_vat
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} className="text-primary" />
            Veille marché
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pour chaque EAN où tu as une offre, compare ton prix avec les autres vendeurs MediKong et les sources externes.
          </p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <VCard className="p-4">
          <div className="text-xs text-muted-foreground">EAN suivis</div>
          <div className="text-2xl font-bold mt-1">{kpis.total}</div>
        </VCard>
        <VCard className="p-4">
          <div className="text-xs text-muted-foreground">En #1 MediKong</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{kpis.winning}</div>
        </VCard>
        <VCard className="p-4">
          <div className="text-xs text-muted-foreground">Battu par un vendeur MK</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{kpis.losingMedikong}</div>
        </VCard>
        <VCard className="p-4">
          <div className="text-xs text-muted-foreground">Battu par une source externe</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{kpis.losingExternal}</div>
        </VCard>
      </div>

      {/* Filtres */}
      <VCard className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Rechercher (nom, EAN, CNK, marque)…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Tag
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Filtrer par EAN ou CNK exact…"
              className="pl-9 pr-9 font-mono text-[12px]"
              value={eanFilter}
              onChange={(e) => setEanFilter(e.target.value)}
              inputMode="numeric"
            />
            {eanFilter && (
              <button
                onClick={() => setEanFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Effacer le filtre EAN"
                type="button"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Statut :
          </span>
          {([
            { k: "all", label: `Tous (${rows.length})` },
            { k: "winning", label: "En #1" },
            { k: "losing_mk", label: "Battu (MediKong)" },
            { k: "losing_ext", label: "Battu (externe)" },
          ] as { k: StatusFilter; label: string }[]).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setStatusFilter(opt.k)}
              type="button"
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === opt.k
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {(search || eanFilter || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setEanFilter("");
                setStatusFilter("all");
              }}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground">
          {filtered.length} ligne{filtered.length > 1 ? "s" : ""} affichée
          {filtered.length > 1 ? "s" : ""} sur {rows.length}
          {(search || eanFilter || statusFilter !== "all") && (
            <span className="ml-2 italic">· filtre mémorisé</span>
          )}
        </div>
      </VCard>

      {/* Tableau */}
      <VCard className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Aucun produit avec une offre active à analyser.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <SortHeader
                      label="Produit"
                      active={sortKey === "product_name"}
                      dir={sortDir}
                      onClick={() => toggleSort("product_name")}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Mon prix HTVA"
                      active={sortKey === "my_price_excl_vat"}
                      dir={sortDir}
                      onClick={() => toggleSort("my_price_excl_vat")}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-center">
                    <SortHeader
                      label="Rang MK"
                      active={sortKey === "my_rank"}
                      dir={sortDir}
                      onClick={() => toggleSort("my_rank")}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader
                      label="Mon statut"
                      active={sortKey === "availability"}
                      dir={sortDir}
                      onClick={() => toggleSort("availability")}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Concurrents</th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Concurrents MK"
                      active={sortKey === "medikong_competitors_count"}
                      dir={sortDir}
                      onClick={() => toggleSort("medikong_competitors_count")}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Meilleur MK"
                      active={sortKey === "best_medikong_competitor_price"}
                      dir={sortDir}
                      onClick={() => toggleSort("best_medikong_competitor_price")}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Sources ext."
                      active={sortKey === "external_sources_count"}
                      dir={sortDir}
                      onClick={() => toggleSort("external_sources_count")}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Meilleur ext."
                      active={sortKey === "best_external_price"}
                      dir={sortDir}
                      onClick={() => toggleSort("best_external_price")}
                      align="right"
                    />
                  </th>
                  <th className="px-4 py-3 text-center">Détail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const beatenByMK =
                    r.best_medikong_competitor_price != null &&
                    r.best_medikong_competitor_price < r.my_price_excl_vat;
                  const beatenByExt =
                    r.best_external_price != null &&
                    r.best_external_price < r.my_price_excl_vat;
                  return (
                    <tr
                      key={r.my_offer_id}
                      className="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.product_image ? (
                            <img
                              src={r.product_image}
                              alt=""
                              className="w-10 h-10 rounded object-cover bg-muted flex-shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[280px]">
                              {r.product_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.brand_name && <span>{r.brand_name} · </span>}
                              EAN: {r.gtin || "—"}
                              {r.cnk_code && <span> · CNK: {r.cnk_code}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {fmt(r.my_price_excl_vat)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RankBadge rank={r.my_rank} total={r.medikong_total_offers} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <StockBadge qty={r.my_stock} status={r.my_stock_status} />
                          <FreshnessLabel date={r.my_updated_at} />
                          {(r.product_discount_percentage ?? 0) > 0 && (
                            <PromoBadge discount={r.product_discount_percentage} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              r.competitors_in_stock > 0
                                ? "text-emerald-600 font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            <CheckCircle2 size={11} /> {r.competitors_in_stock} en stock
                          </span>
                          {r.competitors_on_promo > 0 && (
                            <span className="inline-flex items-center gap-1 text-pink-700 font-medium">
                              <Tag size={11} /> {r.competitors_on_promo} en promo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.medikong_competitors_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={beatenByMK ? "text-red-600 font-medium" : ""}>
                          {fmt(r.best_medikong_competitor_price)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.external_sources_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={beatenByExt ? "text-red-600 font-medium" : ""}>
                          {fmt(r.best_external_price)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {(beatenByMK || beatenByExt) && (
                            <button
                              onClick={() =>
                                setAdjustCtx({
                                  offerId: r.my_offer_id,
                                  productName: r.product_name,
                                  gtin: r.gtin,
                                  myPrice: r.my_price_excl_vat,
                                  bestMkPrice: r.best_medikong_competitor_price,
                                  bestExtPrice: r.best_external_price,
                                  vendorId,
                                  productId: r.product_id,
                                })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                              title="Ajuster mon prix face à la concurrence"
                            >
                              <Wand2 size={10} /> Ajuster
                            </button>
                          )}
                          <button
                            onClick={() => setOpenRow(r)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Voir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </VCard>

      {/* Détail modal */}
      <Dialog open={openRow !== null} onOpenChange={(v) => !v && setOpenRow(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between gap-3">
              <div>
                {safeOpenRow?.product_name}
                <div className="text-xs font-normal text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>
                    EAN {safeOpenRow?.gtin || "—"} · {safeOpenRow?.country_code}
                  </span>
                  {openRowGuarded && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium"
                      title="Le serveur n'a pas encore répliqué votre dernière sauvegarde — affichage du prix le plus récent connu localement."
                      aria-live="polite"
                    >
                      <Clock size={10} /> Prix synchronisé localement
                    </span>
                  )}
                  {!openRowGuarded && isFetchingIntel && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                      aria-live="polite"
                    >
                      <Loader2 size={10} className="animate-spin" /> Mise à jour…
                    </span>
                  )}
                </div>
              </div>
              {safeOpenRow && (
                <button
                  onClick={() =>
                    setAdjustCtx({
                      offerId: safeOpenRow.my_offer_id,
                      productName: safeOpenRow.product_name,
                      gtin: safeOpenRow.gtin,
                      myPrice: safeOpenRow.my_price_excl_vat,
                      bestMkPrice: safeOpenRow.best_medikong_competitor_price,
                      bestExtPrice: safeOpenRow.best_external_price,
                      vendorId,
                      productId: safeOpenRow.product_id,
                    })
                  }
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Wand2 size={12} /> Ajuster mon prix
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          {safeOpenRow && (() => {
            // Alias local : tout le rendu du popup utilise la version
            // garde-fou de la ligne (cf. `safeOpenRow`) pour ne jamais
            // afficher un `my_price_excl_vat` antérieur à la dernière
            // sauvegarde locale pendant un refetch en vol.
            const openRow = safeOpenRow;
            // Prix utilisé pour les calculs : prix saisi en live dans le modal d'ajustement
            // s'il est valide, sinon le prix (garde-fou) de l'offre actuelle.
            const effectiveMyPrice =
              livePrice != null && livePrice > 0 ? livePrice : openRow.my_price_excl_vat;
            const isLive = livePrice != null && livePrice > 0 && livePrice !== openRow.my_price_excl_vat;
            return (
            <div className="space-y-6">
              {/* Marge & commission sur l'offre actuelle du vendeur */}
              {commissionConfig && (
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 flex-wrap">
                    <Wand2 size={14} /> Mon offre — marge & commission MediKong
                    {isLive && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 transition-transform ${
                          livePulse ? "scale-105 ring-2 ring-emerald-300/60" : ""
                        }`}
                        title={
                          liveRecalcAt
                            ? `Recalculé à ${new Date(liveRecalcAt).toLocaleTimeString("fr-BE")}`
                            : undefined
                        }
                        aria-live="polite"
                      >
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ${
                            livePulse ? "animate-ping" : ""
                          }`}
                        />
                        En direct
                        {liveRecalcAt && (
                          <span className="text-emerald-600/80 tabular-nums">
                            · {new Date(liveRecalcAt).toLocaleTimeString("fr-BE", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        )}
                        <span className="text-emerald-600/80">
                          · {effectiveMyPrice.toFixed(2)} €
                        </span>
                      </span>
                    )}
                  </h3>
                  <MarginInsightCard
                    breakdown={computeMargin(
                      effectiveMyPrice,
                      openRowPurchasePrice ?? null,
                      commissionConfig,
                    )}
                    commissionModel={commissionConfig.commission_model}
                  />
                  {/* Avant / Après — affiché après chaque sauvegarde de prix réussie */}
                  {(() => {
                    const ls = lastSaves[openRow.my_offer_id];
                    if (!ls || ls.oldPrice === ls.newPrice) return null;
                    const before = computeMargin(
                      ls.oldPrice,
                      openRowPurchasePrice ?? null,
                      commissionConfig,
                    );
                    const after = computeMargin(
                      ls.newPrice,
                      openRowPurchasePrice ?? null,
                      commissionConfig,
                    );
                    const delta = after.netRevenue - before.netRevenue;
                    const deltaPct =
                      before.netRevenue > 0 ? (delta / before.netRevenue) * 100 : 0;
                    const positive = delta >= 0;
                    return (
                      <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-blue-900">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px]">
                              Avant / Après
                            </span>
                            <span className="text-blue-700/80 font-normal">
                              Sauvegarde à{" "}
                              {new Date(ls.savedAt).toLocaleTimeString("fr-BE", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setLastSaves((prev) => {
                                const { [openRow.my_offer_id]: _, ...rest } = prev;
                                return rest;
                              })
                            }
                            className="text-[10px] text-blue-700/70 hover:text-blue-900 hover:underline"
                          >
                            Masquer
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                          <div className="rounded-md border border-blue-100 bg-white p-2">
                            <div className="text-[9px] uppercase text-muted-foreground">
                              Avant
                            </div>
                            <div className="text-muted-foreground">
                              Prix {fmt(before.sellPrice)}
                            </div>
                            <div className="font-semibold text-foreground/80">
                              Net {fmt(before.netRevenue)}
                            </div>
                            <div className="text-[10px] text-destructive">
                              − {fmt(before.commission)} comm.
                            </div>
                          </div>
                          <div className="rounded-md border border-blue-200 bg-white p-2 ring-1 ring-blue-300/40">
                            <div className="text-[9px] uppercase text-blue-700">
                              Après
                            </div>
                            <div className="text-muted-foreground">
                              Prix {fmt(after.sellPrice)}
                            </div>
                            <div className="font-semibold text-blue-900">
                              Net {fmt(after.netRevenue)}
                            </div>
                            <div className="text-[10px] text-destructive">
                              − {fmt(after.commission)} comm.
                            </div>
                          </div>
                          <div
                            className={`rounded-md border p-2 flex flex-col justify-center items-start ${
                              positive
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-orange-200 bg-orange-50"
                            }`}
                          >
                            <div className="text-[9px] uppercase text-muted-foreground">
                              Δ Net
                            </div>
                            <div
                              className={`font-bold text-sm ${
                                positive ? "text-emerald-700" : "text-orange-700"
                              }`}
                            >
                              {positive ? "▲ +" : "▼ "}
                              {Math.abs(delta).toFixed(2)} €
                            </div>
                            <div
                              className={`text-[10px] ${
                                positive ? "text-emerald-600" : "text-orange-600"
                              }`}
                            >
                              ({positive ? "+" : ""}
                              {deltaPct.toFixed(1)} %)
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-2">
                    <MarginBreakdownDetails
                      breakdown={computeMargin(
                        effectiveMyPrice,
                        openRowPurchasePrice ?? null,
                        commissionConfig,
                      )}
                      commissionModel={commissionConfig.commission_model}
                      commissionRate={commissionConfig.commission_rate}
                      marginSplitPct={commissionConfig.margin_split_pct}
                      fixedCommissionAmount={commissionConfig.fixed_commission_amount}
                      offerId={openRow.my_offer_id}
                    />
                  </div>
                  {openRowPurchasePrice == null && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Astuce : renseignez votre prix d'achat sur la fiche offre pour voir aussi votre marge nette.
                    </p>
                  )}
                </section>
              )}

              {/* Offres MediKong */}
              {(() => {
                const allOffers = openRow.medikong_offers || [];
                // Calcul net pour chaque offre (basé sur la commission du vendeur courant).
                // Pour l'offre "is_mine", on utilise le prix live tapé dans le modal d'ajustement
                // (s'il y en a un) afin de refléter immédiatement la nouvelle position concurrentielle.
                const withNet = allOffers.map((o) => {
                  const priceForCalc = o.is_mine ? effectiveMyPrice : o.price_excl_vat;
                  const net = commissionConfig
                    ? computeMargin(priceForCalc, openRowPurchasePrice ?? null, commissionConfig).netRevenue
                    : null;
                  return { o, net, priceForCalc };
                });
                // Net de l'offre du vendeur courant (référence pour le filtre "mieux/pire")
                const myNet = withNet.find(({ o }) => o.is_mine)?.net ?? null;
                // Filtre
                let filtered = withNet;
                if (mkFilter !== "all" && myNet != null) {
                  filtered = withNet.filter(({ o, net }) => {
                    if (o.is_mine || net == null) return false;
                    return mkFilter === "better" ? net > myNet : net < myNet;
                  });
                }
                // Tri
                const sorted = [...filtered].sort((a, b) => {
                  if (!mkSortKey) return 0;
                  const va =
                    mkSortKey === "net" ? a.net ?? -Infinity : a.priceForCalc;
                  const vb =
                    mkSortKey === "net" ? b.net ?? -Infinity : b.priceForCalc;
                  return mkSortDir === "asc" ? va - vb : vb - va;
                });
                const toggleSort = (key: "net" | "price") => {
                  if (mkSortKey !== key) {
                    setMkSortKey(key);
                    setMkSortDir(key === "net" ? "desc" : "asc");
                  } else {
                    setMkSortDir(mkSortDir === "asc" ? "desc" : "asc");
                  }
                };
                const SortIcon = ({ k }: { k: "net" | "price" }) =>
                  mkSortKey !== k ? (
                    <ArrowUpDown size={10} className="inline ml-1 opacity-50" />
                  ) : mkSortDir === "asc" ? (
                    <ArrowUp size={10} className="inline ml-1" />
                  ) : (
                    <ArrowDown size={10} className="inline ml-1" />
                  );
                return (
                  <section>
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Store size={14} /> Offres MediKong ({sorted.length}
                        {sorted.length !== allOffers.length ? ` / ${allOffers.length}` : ""})
                      </h3>
                      {commissionConfig && allOffers.length > 1 && (
                        <div className="flex items-center gap-1 text-[10px]">
                          {([
                            ["all", "Toutes"],
                            ["better", "Net > le mien"],
                            ["worse", "Net < le mien"],
                          ] as const).map(([k, label]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setMkFilter(k)}
                              disabled={k !== "all" && myNet == null}
                              className={`px-2 py-1 rounded-md border transition-colors ${
                                mkFilter === k
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted text-muted-foreground border-border"
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                              title={
                                k !== "all" && myNet == null
                                  ? "Indisponible : votre offre n'est pas dans la liste"
                                  : undefined
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Vendeur</th>
                            <th className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => toggleSort("price")}
                                className="inline-flex items-center hover:text-foreground transition-colors uppercase"
                              >
                                Prix HTVA
                                <SortIcon k="price" />
                              </button>
                            </th>
                            <th
                              className="px-3 py-2 text-right"
                              title="Net en poche estimé si vous vendiez à ce prix (prix − commission MediKong)"
                            >
                              <button
                                type="button"
                                onClick={() => toggleSort("net")}
                                className="inline-flex items-center hover:text-foreground transition-colors uppercase"
                              >
                                Net après commission
                                <SortIcon k="net" />
                              </button>
                            </th>
                            <th className="px-3 py-2 text-left">Statut</th>
                            <th className="px-3 py-2 text-center">Promo</th>
                            <th className="px-3 py-2 text-right">Délai</th>
                            <th className="px-3 py-2 text-left">Dernière MAJ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                                Aucune offre ne correspond à ce filtre.
                              </td>
                            </tr>
                          ) : (
                            sorted.map(({ o, net, priceForCalc }, i) => (
                              <tr
                                key={o.offer_id}
                                className={`border-t ${o.is_mine ? "bg-primary/5" : ""}`}
                              >
                                <td className="px-3 py-2">
                                  {i === 0 && mkSortKey == null && mkFilter === "all" && (
                                    <Trophy
                                      size={11}
                                      className="inline -mt-0.5 mr-1 text-emerald-600"
                                    />
                                  )}
                                  {o.vendor_name}
                                  {o.is_mine && (
                                    <span className="ml-1 text-[10px] text-primary font-semibold">
                                      (vous{isLive ? " · live" : ""})
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {o.is_mine && isLive ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground line-through">
                                        {fmt(o.price_excl_vat)}
                                      </span>
                                      <span className="text-amber-700">{fmt(priceForCalc)}</span>
                                    </span>
                                  ) : (
                                    fmt(priceForCalc)
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {net != null && commissionConfig ? (() => {
                                    const m = computeMargin(
                                      priceForCalc,
                                      openRowPurchasePrice ?? null,
                                      commissionConfig,
                                    );
                                    const model = commissionConfig.commission_model;
                                    const formulaLabel =
                                      model === "flat_percentage"
                                        ? `Commission = prix × ${commissionConfig.commission_rate ?? 0}%`
                                        : model === "margin_split"
                                          ? `Commission = max(0, prix − achat) × ${Math.max(
                                              0,
                                              100 - (commissionConfig.margin_split_pct ?? 0),
                                            )}%`
                                          : `Commission = ${fmtEur(
                                              commissionConfig.fixed_commission_amount ?? 0,
                                            )} (forfait)`;
                                    const formulaCalc =
                                      model === "flat_percentage"
                                        ? `${fmtEur(m.sellPrice)} × ${commissionConfig.commission_rate ?? 0}% = ${fmtEur(m.commission)}`
                                        : model === "margin_split"
                                          ? `max(0, ${fmtEur(m.sellPrice)} − ${fmtEur(m.purchasePrice)}) × ${Math.max(
                                              0,
                                              100 - (commissionConfig.margin_split_pct ?? 0),
                                            )}% = ${fmtEur(m.commission)}`
                                          : `${fmtEur(m.commission)} (forfait)`;
                                    return (
                                      <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span
                                              className={`cursor-help underline decoration-dotted underline-offset-2 ${
                                                o.is_mine
                                                  ? "font-semibold text-primary"
                                                  : "text-muted-foreground"
                                              }`}
                                            >
                                              {fmtEur(net)}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="left"
                                            className="max-w-[300px] text-[11px] space-y-1.5 p-3"
                                          >
                                            <div className="font-semibold text-xs border-b border-border pb-1 mb-1">
                                              Net après commission MediKong
                                            </div>
                                            <div className="flex justify-between gap-4 tabular-nums">
                                              <span className="text-muted-foreground">Prix HTVA</span>
                                              <span>{fmtEur(m.sellPrice)}</span>
                                            </div>
                                            <div className="flex justify-between gap-4 tabular-nums text-destructive">
                                              <span>Commission MediKong</span>
                                              <span>
                                                −{fmtEur(m.commission)} ({m.commissionPct.toFixed(1)} %)
                                              </span>
                                            </div>
                                            <div className="flex justify-between gap-4 tabular-nums font-semibold border-t border-border pt-1 mt-1">
                                              <span>Net en poche</span>
                                              <span>{fmtEur(m.netRevenue)}</span>
                                            </div>
                                            <div className="border-t border-border pt-1.5 mt-1.5 space-y-0.5">
                                              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                                                Formule (
                                                {model === "flat_percentage"
                                                  ? "% fixe"
                                                  : model === "margin_split"
                                                    ? "partage de marge"
                                                    : "forfait"}
                                                )
                                              </div>
                                              <div className="font-mono text-[10px]">{formulaLabel}</div>
                                              <div className="font-mono text-[10px] text-foreground/80">
                                                {formulaCalc}
                                              </div>
                                            </div>
                                            {model === "margin_split" && !m.hasCost && (
                                              <div className="text-[10px] text-amber-600 border-t border-border pt-1 mt-1">
                                                ⚠ Prix d'achat inconnu : commission estimée à 0. Renseignez votre coût pour un calcul exact.
                                              </div>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })() : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <StockBadge qty={o.stock_quantity} status={o.stock_status} />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {o.is_promo ? (
                                    <PromoBadge discount={o.promo_discount} />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {o.delivery_days != null ? `${o.delivery_days} j` : "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <FreshnessLabel date={o.updated_at} />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })()}

              {/* Offres externes */}
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Globe size={14} /> Sources externes ({openRow.external_offers?.length || 0})
                </h3>
                {(openRow.external_offers?.length || 0) === 0 ? (
                  <div className="text-xs text-muted-foreground border rounded-lg p-4 text-center">
                    Aucune source externe matchée pour cet EAN.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Source</th>
                          <th className="px-3 py-2 text-right">Grossiste</th>
                          <th className="px-3 py-2 text-right">Pharmacien</th>
                          <th className="px-3 py-2 text-right">Public</th>
                          <th className="px-3 py-2 text-left">Stock</th>
                          <th className="px-3 py-2 text-left">Importé</th>
                          <th className="px-3 py-2 text-center">Lien</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openRow.external_offers.map((e, i) => (
                          <tr key={`${e.source_id}-${i}`} className="border-t">
                            <td className="px-3 py-2">{e.source_name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmt(e.prix_grossiste)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmt(e.prix_pharmacien)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmt(e.prix_public)}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-muted-foreground">
                              {e.stock_source || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <FreshnessLabel date={e.imported_at} />
                            </td>
                            <td className="px-3 py-2 text-center">
                              {e.product_url ? (
                                <a
                                  href={e.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <ExternalLink size={12} className="inline" />
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Adjust price modal */}
      <AdjustPriceModal
        open={adjustCtx !== null}
        onOpenChange={(v) => {
          if (!v) {
            setAdjustCtx(null);
            setLivePrice(null);
          }
        }}
        ctx={adjustCtx}
        onPriceChange={setLivePrice}
        onPriceSaved={(oldPrice, newPrice) => {
          if (!adjustCtx) return;
          setLastSaves((prev) => ({
            ...prev,
            [adjustCtx.offerId]: { oldPrice, newPrice, savedAt: Date.now() },
          }));
        }}
      />
    </div>
  );
}
