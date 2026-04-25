import { useMemo, useState } from "react";
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
} from "lucide-react";

interface MedikongOffer {
  offer_id: string;
  vendor_id: string;
  vendor_name: string;
  price_excl_vat: number;
  stock_quantity: number;
  delivery_days: number | null;
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
  my_offer_id: string;
  my_price_excl_vat: number;
  my_stock: number;
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
  medikong_offers: MedikongOffer[];
  external_offers: ExternalOffer[];
}

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toFixed(2)} €` : "—";

const ordinal = (n: number) => (n === 1 ? "1ᵉʳ" : `${n}ᵉ`);

const fmtSignedEur = (n: number | null | undefined) => {
  if (typeof n !== "number") return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} €`;
};

const fmtSignedPct = (n: number | null | undefined) => {
  if (typeof n !== "number") return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
};

type SortKey =
  | "product_name"
  | "my_price_excl_vat"
  | "my_rank"
  | "medikong_competitors_count"
  | "best_medikong_competitor_price"
  | "medikong_median_price"
  | "gap_vs_best_percentage"
  | "gap_vs_median_percentage"
  | "external_sources_count"
  | "best_external_price";

type SortDir = "asc" | "desc";

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1)
    return (
      <VBadge color="#16A34A" bg="#DCFCE7">
        <Trophy size={11} className="inline -mt-0.5 mr-1" />
        {ordinal(rank)} / {total}
      </VBadge>
    );
  if (rank === 2)
    return (
      <VBadge color="#CA8A04" bg="#FEF3C7">
        {ordinal(rank)} / {total}
      </VBadge>
    );
  return (
    <VBadge color="#DC2626" bg="#FEE2E2">
      {ordinal(rank)} / {total}
    </VBadge>
  );
}

function GapCell({
  amount,
  pct,
}: {
  amount: number | null;
  pct: number | null;
}) {
  if (amount == null || pct == null) return <span>—</span>;
  const isPositive = amount > 0;
  const isZero = Math.abs(amount) < 0.005;
  const cls = isZero
    ? "text-muted-foreground"
    : isPositive
      ? "text-red-600"
      : "text-emerald-600";
  return (
    <div className={`tabular-nums ${cls}`}>
      <div className="font-medium">{fmtSignedEur(amount)}</div>
      <div className="text-[10px]">{fmtSignedPct(pct)}</div>
    </div>
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
      <Icon
        size={12}
        className={active ? "text-foreground" : "text-muted-foreground/50"}
      />
    </button>
  );
}

export default function VendorMarketIntel() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = (vendor as any)?.id;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("gap_vs_best_percentage");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [openRow, setOpenRow] = useState<IntelRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-market-intel", vendorId],
    queryFn: async (): Promise<IntelRow[]> => {
      if (!vendorId) return [];
      const { data, error } = await (supabase.rpc as any)(
        "get_vendor_market_intelligence",
        { _vendor_id: vendorId },
      );
      if (error) throw error;
      return (data || []) as IntelRow[];
    },
    enabled: Boolean(vendorId),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
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
    const sorted = [...arr].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
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
  }, [rows, search, sortKey, sortDir]);

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
        r.best_external_price != null &&
        r.best_external_price < r.my_price_excl_vat,
    ).length;
    return { total, winning, losingMedikong, losingExternal };
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} className="text-primary" />
            Veille marché
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pour chaque EAN où tu as une offre, compare ton classement, ton écart
            avec le moins cher et le prix médian du marché.
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
          <div className="text-xs text-muted-foreground">En 1ᵉʳ MediKong</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {kpis.winning}
          </div>
        </VCard>
        <VCard className="p-4">
          <div className="text-xs text-muted-foreground">
            Battu par un vendeur MK
          </div>
          <div className="text-2xl font-bold mt-1 text-orange-600">
            {kpis.losingMedikong}
          </div>
        </VCard>
        <VCard className="p-4">
          <div className="text-xs text-muted-foreground">
            Battu par une source externe
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {kpis.losingExternal}
          </div>
        </VCard>
      </div>

      {/* Filtre */}
      <VCard className="p-4">
        <div className="relative max-w-md">
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
                  <th className="px-3 py-3 text-left">
                    <SortHeader
                      label="Produit"
                      active={sortKey === "product_name"}
                      dir={sortDir}
                      onClick={() => toggleSort("product_name")}
                    />
                  </th>
                  <th className="px-3 py-3 text-center">
                    <SortHeader
                      label="Classement"
                      active={sortKey === "my_rank"}
                      dir={sortDir}
                      onClick={() => toggleSort("my_rank")}
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Mon prix"
                      active={sortKey === "my_price_excl_vat"}
                      dir={sortDir}
                      onClick={() => toggleSort("my_price_excl_vat")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Moins cher MK"
                      active={sortKey === "best_medikong_competitor_price"}
                      dir={sortDir}
                      onClick={() => toggleSort("best_medikong_competitor_price")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Écart vs min"
                      active={sortKey === "gap_vs_best_percentage"}
                      dir={sortDir}
                      onClick={() => toggleSort("gap_vs_best_percentage")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Médian MK"
                      active={sortKey === "medikong_median_price"}
                      dir={sortDir}
                      onClick={() => toggleSort("medikong_median_price")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Écart vs médian"
                      active={sortKey === "gap_vs_median_percentage"}
                      dir={sortDir}
                      onClick={() => toggleSort("gap_vs_median_percentage")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Sources ext."
                      active={sortKey === "external_sources_count"}
                      dir={sortDir}
                      onClick={() => toggleSort("external_sources_count")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortHeader
                      label="Meilleur ext."
                      active={sortKey === "best_external_price"}
                      dir={sortDir}
                      onClick={() => toggleSort("best_external_price")}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-3 text-center">Détail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const beatenByExt =
                    r.best_external_price != null &&
                    r.best_external_price < r.my_price_excl_vat;
                  return (
                    <tr
                      key={r.my_offer_id}
                      className="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-3">
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
                            <div className="font-medium truncate max-w-[260px]">
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
                      <td className="px-3 py-3 text-center">
                        <RankBadge
                          rank={r.my_rank}
                          total={r.medikong_total_offers}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {fmt(r.my_price_excl_vat)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmt(r.best_medikong_competitor_price)}
                        {r.best_medikong_competitor_vendor && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px] ml-auto">
                            {r.best_medikong_competitor_vendor}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <GapCell
                          amount={r.gap_vs_best_amount}
                          pct={r.gap_vs_best_percentage}
                        />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmt(r.medikong_median_price)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <GapCell
                          amount={r.gap_vs_median_amount}
                          pct={r.gap_vs_median_percentage}
                        />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.external_sources_count}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span
                          className={beatenByExt ? "text-red-600 font-medium" : ""}
                        >
                          {fmt(r.best_external_price)}
                        </span>
                        {r.best_external_source && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px] ml-auto">
                            {r.best_external_source}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setOpenRow(r)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Voir
                        </button>
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
            <DialogTitle className="text-base">
              {openRow?.product_name}
              <div className="text-xs font-normal text-muted-foreground mt-1">
                EAN {openRow?.gtin || "—"} · {openRow?.country_code}
                {openRow && (
                  <>
                    {" "}· Classé{" "}
                    <strong className="text-foreground">
                      {ordinal(openRow.my_rank)} sur{" "}
                      {openRow.medikong_total_offers}
                    </strong>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {openRow && (
            <div className="space-y-6">
              {/* Synthèse */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Mon prix
                  </div>
                  <div className="text-base font-semibold mt-0.5 tabular-nums">
                    {fmt(openRow.my_price_excl_vat)}
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Écart vs moins cher
                  </div>
                  <div className="text-base font-semibold mt-0.5 tabular-nums">
                    <GapCell
                      amount={openRow.gap_vs_best_amount}
                      pct={openRow.gap_vs_best_percentage}
                    />
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Écart vs médian ({fmt(openRow.medikong_median_price)})
                  </div>
                  <div className="text-base font-semibold mt-0.5 tabular-nums">
                    <GapCell
                      amount={openRow.gap_vs_median_amount}
                      pct={openRow.gap_vs_median_percentage}
                    />
                  </div>
                </div>
              </div>

              {/* Offres MediKong */}
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Store size={14} /> Offres MediKong (
                  {openRow.medikong_offers?.length || 0})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Rang</th>
                        <th className="px-3 py-2 text-left">Vendeur</th>
                        <th className="px-3 py-2 text-right">Prix HTVA</th>
                        <th className="px-3 py-2 text-right">Stock</th>
                        <th className="px-3 py-2 text-right">Délai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(openRow.medikong_offers || []).map((o, i) => (
                        <tr
                          key={o.offer_id}
                          className={`border-t ${o.is_mine ? "bg-primary/5" : ""}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {i === 0 ? (
                              <Trophy
                                size={11}
                                className="inline -mt-0.5 mr-1 text-emerald-600"
                              />
                            ) : null}
                            {ordinal(i + 1)}
                          </td>
                          <td className="px-3 py-2">
                            {o.vendor_name}
                            {o.is_mine && (
                              <span className="ml-1 text-[10px] text-primary font-semibold">
                                (vous)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {fmt(o.price_excl_vat)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {o.stock_quantity ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {o.delivery_days != null ? `${o.delivery_days} j` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Offres externes */}
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Globe size={14} /> Sources externes (
                  {openRow.external_offers?.length || 0})
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
                          <th className="px-3 py-2 text-center">Lien</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openRow.external_offers.map((e, i) => (
                          <tr
                            key={`${e.source_id}-${i}`}
                            className="border-t"
                          >
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
