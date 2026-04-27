import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HIDDEN_CATEGORY_KEYWORDS } from "@/lib/catalog-filters";
import {
  RefreshCw, Eye, EyeOff, Layers, Package, Tag, AlertCircle,
  CheckCircle2, ShieldAlert, FolderX, FileQuestion, ExternalLink, Search,
} from "lucide-react";

type HiddenReason = "keyword" | "inactive_category" | "no_category";

type HiddenOffer = {
  offerId: string;
  productId: string;
  productName: string;
  categoryName: string | null;
  vendorName: string | null;
  reason: HiddenReason;
  matchedKeyword?: string;
};

type Stats = {
  categories: {
    total: number;
    active: number;
    inactive: number;
    hiddenByKeyword: number;
    hiddenSamples: { id: string; name: string; matched: string }[];
    inactiveSamples: { id: string; name: string }[];
  };
  products: {
    totalActive: number;
    visiblePublic: number;
    hiddenByKeyword: number;
    hiddenByInactiveCategory: number;
    withoutCategory: number;
    keywordBreakdown: { keyword: string; count: number }[];
  };
  offers: {
    activeTotal: number;
    visiblePublic: number;
    hiddenByKeyword: number;
    hiddenByInactiveCategory: number;
    onProductsWithoutCategory: number;
  };
  generatedAt: string;
};

const KEYWORDS = HIDDEN_CATEGORY_KEYWORDS;

const matchedKeyword = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const lower = name.toLowerCase();
  return KEYWORDS.find((kw) => lower.includes(kw)) ?? null;
};

async function loadStats(): Promise<Stats> {
  // ---- Categories ---------------------------------------------------------
  const { data: cats, error: catsErr } = await supabase
    .from("categories")
    .select("id,name,is_active")
    .order("name", { ascending: true });
  if (catsErr) throw catsErr;

  const catList = cats ?? [];
  const catActive = catList.filter((c) => c.is_active);
  const catInactive = catList.filter((c) => !c.is_active);
  const catHiddenByKw = catList.filter((c) => matchedKeyword(c.name));
  const inactiveCategoryNames = new Set(
    catInactive.map((c) => (c.name ?? "").toLowerCase()).filter(Boolean),
  );

  // ---- Products counts ----------------------------------------------------
  const countQuery = (build: (q: any) => any) => {
    const base = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    return build(base).then((r: any) => r.count ?? 0);
  };

  const totalActive: number = await countQuery((q) => q);

  // products without a category_name
  const withoutCategory: number = await countQuery((q) => q.is("category_name", null));

  // products hidden by keyword (any of the configured keywords)
  let hiddenByKeyword = 0;
  const keywordBreakdown: { keyword: string; count: number }[] = [];
  for (const kw of KEYWORDS) {
    const c: number = await countQuery((q) => q.ilike("category_name", `%${kw}%`));
    keywordBreakdown.push({ keyword: kw, count: c });
    hiddenByKeyword += c;
  }
  // crude de-dup: keywords overlap rarely, but cap at totalActive
  hiddenByKeyword = Math.min(hiddenByKeyword, totalActive);

  // products on inactive categories — chunk through name list to stay under URL limits
  const inactiveNames = Array.from(inactiveCategoryNames).filter(Boolean);
  let hiddenByInactiveCategory = 0;
  const CHUNK = 50;
  for (let i = 0; i < inactiveNames.length; i += CHUNK) {
    const slice = inactiveNames.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .in("category_name", slice);
    hiddenByInactiveCategory += count ?? 0;
  }

  const hiddenAny = Math.min(
    totalActive,
    hiddenByKeyword + hiddenByInactiveCategory + withoutCategory,
  );
  const visiblePublic = Math.max(0, totalActive - hiddenAny);

  // ---- Offers counts ------------------------------------------------------
  const offerCount = (build: (q: any) => any) => {
    const base = supabase
      .from("offers")
      .select("id, products!inner(category_name)", { count: "exact", head: true })
      .eq("is_active", true);
    return build(base).then((r: any) => r.count ?? 0);
  };

  const offersActive: number = await offerCount((q) => q);
  const offersOnNoCategory: number = await offerCount((q) =>
    q.is("products.category_name", null),
  );

  let offersHiddenByKeyword = 0;
  for (const kw of KEYWORDS) {
    const c: number = await offerCount((q) => q.ilike("products.category_name", `%${kw}%`));
    offersHiddenByKeyword += c;
  }
  offersHiddenByKeyword = Math.min(offersHiddenByKeyword, offersActive);

  let offersHiddenByInactiveCategory = 0;
  for (let i = 0; i < inactiveNames.length; i += CHUNK) {
    const slice = inactiveNames.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { count } = await supabase
      .from("offers")
      .select("id, products!inner(category_name)", { count: "exact", head: true })
      .eq("is_active", true)
      .in("products.category_name", slice);
    offersHiddenByInactiveCategory += count ?? 0;
  }

  const offersHiddenAny = Math.min(
    offersActive,
    offersHiddenByKeyword + offersHiddenByInactiveCategory + offersOnNoCategory,
  );
  const offersVisible = Math.max(0, offersActive - offersHiddenAny);

  return {
    categories: {
      total: catList.length,
      active: catActive.length,
      inactive: catInactive.length,
      hiddenByKeyword: catHiddenByKw.length,
      hiddenSamples: catHiddenByKw.slice(0, 12).map((c) => ({
        id: c.id,
        name: c.name ?? "—",
        matched: matchedKeyword(c.name) ?? "",
      })),
      inactiveSamples: catInactive.slice(0, 12).map((c) => ({
        id: c.id,
        name: c.name ?? "—",
      })),
    },
    products: {
      totalActive,
      visiblePublic,
      hiddenByKeyword,
      hiddenByInactiveCategory,
      withoutCategory,
      keywordBreakdown: keywordBreakdown.sort((a, b) => b.count - a.count),
    },
    offers: {
      activeTotal: offersActive,
      visiblePublic: offersVisible,
      hiddenByKeyword: offersHiddenByKeyword,
      hiddenByInactiveCategory: offersHiddenByInactiveCategory,
      onProductsWithoutCategory: offersOnNoCategory,
    },
    generatedAt: new Date().toISOString(),
  };
}

const fmt = (n: number) => n.toLocaleString("fr-FR");

const PAGE_SIZE = 50;

/**
 * Charge un échantillon (max 200) d'offres masquées pour la raison demandée.
 * On limite volontairement la fenêtre — l'objectif est diagnostic, pas export.
 */
async function loadHiddenOffers(reason: HiddenReason): Promise<HiddenOffer[]> {
  // Pré-charge la liste des catégories désactivées pour la raison "inactive_category"
  let inactiveNames: string[] = [];
  if (reason === "inactive_category") {
    const { data: cats } = await supabase
      .from("categories")
      .select("name,is_active")
      .eq("is_active", false);
    inactiveNames = (cats ?? [])
      .map((c) => (c.name ?? "").toLowerCase())
      .filter(Boolean);
    if (inactiveNames.length === 0) return [];
  }

  // Construit la requête base sur offers + product + vendor
  const select =
    "id, vendor:vendors(name), products!inner(id, name, category_name)";

  const aggregate: HiddenOffer[] = [];
  const cap = 200;

  if (reason === "keyword") {
    for (const kw of KEYWORDS) {
      if (aggregate.length >= cap) break;
      const { data, error } = await supabase
        .from("offers")
        .select(select)
        .eq("is_active", true)
        .ilike("products.category_name", `%${kw}%`)
        .limit(Math.min(cap - aggregate.length, 60));
      if (error) throw error;
      for (const row of (data ?? []) as any[]) {
        if (aggregate.length >= cap) break;
        aggregate.push({
          offerId: row.id,
          productId: row.products?.id,
          productName: row.products?.name ?? "—",
          categoryName: row.products?.category_name ?? null,
          vendorName: row.vendor?.name ?? null,
          reason: "keyword",
          matchedKeyword: kw,
        });
      }
    }
  } else if (reason === "inactive_category") {
    const CHUNK = 50;
    for (let i = 0; i < inactiveNames.length && aggregate.length < cap; i += CHUNK) {
      const slice = inactiveNames.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("offers")
        .select(select)
        .eq("is_active", true)
        .in("products.category_name", slice)
        .limit(Math.min(cap - aggregate.length, 100));
      if (error) throw error;
      for (const row of (data ?? []) as any[]) {
        if (aggregate.length >= cap) break;
        aggregate.push({
          offerId: row.id,
          productId: row.products?.id,
          productName: row.products?.name ?? "—",
          categoryName: row.products?.category_name ?? null,
          vendorName: row.vendor?.name ?? null,
          reason: "inactive_category",
        });
      }
    }
  } else if (reason === "no_category") {
    const { data, error } = await supabase
      .from("offers")
      .select(select)
      .eq("is_active", true)
      .is("products.category_name", null)
      .limit(cap);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      aggregate.push({
        offerId: row.id,
        productId: row.products?.id,
        productName: row.products?.name ?? "—",
        categoryName: null,
        vendorName: row.vendor?.name ?? null,
        reason: "no_category",
      });
    }
  }

  // Dédup par offerId (au cas où plusieurs mots-clés matchent la même offre)
  const seen = new Set<string>();
  return aggregate.filter((o) => {
    if (seen.has(o.offerId)) return false;
    seen.add(o.offerId);
    return true;
  });
}
const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
  tone?: "neutral" | "good" | "warn" | "danger";
}) => {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
      : tone === "warn"
        ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
        : tone === "danger"
          ? "text-destructive bg-destructive/10"
          : "text-muted-foreground bg-muted";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={`rounded-md p-1.5 ${toneClass}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">
        {typeof value === "number" ? fmt(value) : value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
};

const AdminCatalogDiagnostics = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Détail offres masquées
  const [hiddenReason, setHiddenReason] = useState<HiddenReason>("keyword");
  const [hiddenOffers, setHiddenOffers] = useState<HiddenOffer[]>([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [hiddenError, setHiddenError] = useState<string | null>(null);
  const [hiddenSearch, setHiddenSearch] = useState("");
  const [hiddenPage, setHiddenPage] = useState(0);

  const fetchHidden = async (reason: HiddenReason) => {
    setHiddenLoading(true);
    setHiddenError(null);
    setHiddenPage(0);
    try {
      const list = await loadHiddenOffers(reason);
      setHiddenOffers(list);
    } catch (e: any) {
      setHiddenError(e?.message ?? String(e));
      setHiddenOffers([]);
    } finally {
      setHiddenLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await loadStats();
      setStats(s);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchHidden(hiddenReason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenReason]);

  const filteredHidden = useMemo(() => {
    const term = hiddenSearch.trim().toLowerCase();
    if (!term) return hiddenOffers;
    return hiddenOffers.filter((o) =>
      [o.productName, o.categoryName, o.vendorName, o.matchedKeyword]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(term)),
    );
  }, [hiddenOffers, hiddenSearch]);

  const pageSlice = filteredHidden.slice(
    hiddenPage * PAGE_SIZE,
    (hiddenPage + 1) * PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil(filteredHidden.length / PAGE_SIZE));

  const visibilityRatio = useMemo(() => {
    if (!stats || stats.products.totalActive === 0) return 0;
    return Math.round((stats.products.visiblePublic / stats.products.totalActive) * 100);
  }, [stats]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Diagnostic visibilité catalogue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue temps réel des produits, offres et catégories visibles ou masqués sur le
            site public, avec les raisons de masquage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-xs text-muted-foreground">
              MAJ : {new Date(stats.generatedAt).toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Rafraîchir
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle size={14} className="mr-2 inline" />
          {error}
        </div>
      )}

      {/* Overview tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Produits visibles"
          value={stats?.products.visiblePublic ?? "—"}
          hint={
            stats
              ? `${visibilityRatio}% du catalogue actif (${fmt(stats.products.totalActive)})`
              : undefined
          }
          icon={Eye}
          tone="good"
        />
        <StatCard
          label="Produits masqués"
          value={
            stats
              ? stats.products.hiddenByKeyword +
                stats.products.hiddenByInactiveCategory +
                stats.products.withoutCategory
              : "—"
          }
          hint="Mots-clés + cat. désactivée + sans cat."
          icon={EyeOff}
          tone="warn"
        />
        <StatCard
          label="Offres visibles"
          value={stats?.offers.visiblePublic ?? "—"}
          hint={
            stats
              ? `sur ${fmt(stats.offers.activeTotal)} offres actives`
              : undefined
          }
          icon={Package}
          tone="good"
        />
        <StatCard
          label="Catégories actives"
          value={stats?.categories.active ?? "—"}
          hint={
            stats
              ? `${fmt(stats.categories.inactive)} désactivée(s) sur ${fmt(stats.categories.total)}`
              : undefined
          }
          icon={Layers}
          tone="neutral"
        />
      </section>

      {/* Reasons breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Products */}
        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package size={16} /> Pourquoi des produits sont masqués
            </h2>
          </header>
          <div className="divide-y divide-border">
            <ReasonRow
              icon={ShieldAlert}
              label="Masqués par mots-clés (catégorie)"
              value={stats?.products.hiddenByKeyword ?? 0}
              hint={`Mots-clés actifs : ${KEYWORDS.join(", ")}`}
              tone="warn"
            />
            <ReasonRow
              icon={FolderX}
              label="Catégorie désactivée"
              value={stats?.products.hiddenByInactiveCategory ?? 0}
              hint="is_active=false sur la catégorie associée"
              tone="warn"
            />
            <ReasonRow
              icon={FileQuestion}
              label="Sans catégorie (category_name nul)"
              value={stats?.products.withoutCategory ?? 0}
              hint="Non rangés — invisibles dans la navigation par catégorie"
              tone="danger"
            />
            <ReasonRow
              icon={CheckCircle2}
              label="Visibles côté public"
              value={stats?.products.visiblePublic ?? 0}
              tone="good"
            />
          </div>

          {stats && stats.products.keywordBreakdown.length > 0 && (
            <div className="border-t border-border p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Détail par mot-clé
              </h3>
              <div className="space-y-1.5">
                {stats.products.keywordBreakdown.map((k) => (
                  <div key={k.keyword} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-foreground">{k.keyword}</span>
                    <span className="tabular-nums text-muted-foreground">{fmt(k.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Offers */}
        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag size={16} /> Offres actives par état de visibilité
            </h2>
          </header>
          <div className="divide-y divide-border">
            <ReasonRow
              icon={ShieldAlert}
              label="Offres masquées par mots-clés"
              value={stats?.offers.hiddenByKeyword ?? 0}
              tone="warn"
            />
            <ReasonRow
              icon={FolderX}
              label="Offres sur catégorie désactivée"
              value={stats?.offers.hiddenByInactiveCategory ?? 0}
              tone="warn"
            />
            <ReasonRow
              icon={FileQuestion}
              label="Offres sur produits sans catégorie"
              value={stats?.offers.onProductsWithoutCategory ?? 0}
              tone="danger"
            />
            <ReasonRow
              icon={CheckCircle2}
              label="Offres visibles côté public"
              value={stats?.offers.visiblePublic ?? 0}
              tone="good"
            />
          </div>
        </div>
      </section>

      {/* Samples */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Exemples de catégories masquées par mots-clés
            </h2>
          </header>
          {stats && stats.categories.hiddenSamples.length > 0 ? (
            <ul className="divide-y divide-border">
              {stats.categories.hiddenSamples.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-foreground">{c.name}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    {c.matched}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Aucune correspondance.</div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Exemples de catégories désactivées
            </h2>
          </header>
          {stats && stats.categories.inactiveSamples.length > 0 ? (
            <ul className="divide-y divide-border">
              {stats.categories.inactiveSamples.map((c) => (
                <li key={c.id} className="px-4 py-2 text-sm text-foreground">
                  {c.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Toutes les catégories sont actives.
            </div>
          )}
        </div>
      </section>

      {/* ============ Détail offres masquées ============ */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag size={16} /> Offres masquées — détail par offre
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Liste (max 200) des offres invisibles côté public, avec la raison exacte
              et un lien direct pour corriger la source du problème.
            </p>
          </div>
          <button
            onClick={() => fetchHidden(hiddenReason)}
            disabled={hiddenLoading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw size={12} className={hiddenLoading ? "animate-spin" : ""} />
            Recharger
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
          {([
            { id: "keyword", label: "Mots-clés", icon: ShieldAlert, count: stats?.offers.hiddenByKeyword },
            { id: "inactive_category", label: "Catégorie désactivée", icon: FolderX, count: stats?.offers.hiddenByInactiveCategory },
            { id: "no_category", label: "Sans catégorie", icon: FileQuestion, count: stats?.offers.onProductsWithoutCategory },
          ] as { id: HiddenReason; label: string; icon: React.ElementType; count?: number }[]).map((r) => {
            const active = hiddenReason === r.id;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => setHiddenReason(r.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-muted border border-border"
                }`}
              >
                <Icon size={12} />
                {r.label}
                {typeof r.count === "number" && (
                  <span className={`ml-1 rounded px-1.5 py-0.5 tabular-nums text-[10px] ${
                    active ? "bg-primary-foreground/20" : "bg-muted"
                  }`}>
                    {fmt(r.count)}
                  </span>
                )}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Filtrer (produit, vendeur, catégorie…)"
                value={hiddenSearch}
                onChange={(e) => { setHiddenSearch(e.target.value); setHiddenPage(0); }}
                className="rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {hiddenError && (
          <div className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle size={12} className="mr-1.5 inline" />
            {hiddenError}
          </div>
        )}

        {hiddenLoading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            <RefreshCw size={14} className="mr-2 inline animate-spin" />
            Chargement des offres masquées…
          </div>
        ) : filteredHidden.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {hiddenOffers.length === 0
              ? "Aucune offre masquée pour cette raison 🎉"
              : "Aucun résultat avec ce filtre."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Produit</th>
                    <th className="px-4 py-2 font-medium">Catégorie</th>
                    <th className="px-4 py-2 font-medium">Vendeur</th>
                    <th className="px-4 py-2 font-medium">Raison</th>
                    <th className="px-4 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageSlice.map((o) => (
                    <tr key={o.offerId} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Link
                          to={`/admin/produits/${o.productId}`}
                          className="font-medium text-foreground hover:text-primary"
                          title="Ouvrir la fiche produit admin"
                        >
                          {o.productName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {o.categoryName ?? <em className="text-destructive">— aucune —</em>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{o.vendorName ?? "—"}</td>
                      <td className="px-4 py-2">
                        {o.reason === "keyword" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            <ShieldAlert size={10} />
                            mot-clé : <span className="font-mono">{o.matchedKeyword}</span>
                          </span>
                        )}
                        {o.reason === "inactive_category" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            <FolderX size={10} />
                            catégorie désactivée
                          </span>
                        )}
                        {o.reason === "no_category" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                            <FileQuestion size={10} />
                            produit sans catégorie
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {o.reason === "no_category" ? (
                          <Link
                            to={`/admin/produits/${o.productId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            Assigner une catégorie <ExternalLink size={11} />
                          </Link>
                        ) : (
                          <Link
                            to={`/admin/categories?search=${encodeURIComponent(o.categoryName ?? "")}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {o.reason === "keyword" ? "Renommer la catégorie" : "Réactiver la catégorie"}
                            <ExternalLink size={11} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              <div>
                {fmt(filteredHidden.length)} offre(s) — page {hiddenPage + 1}/{totalPages}
                {hiddenOffers.length >= 200 && (
                  <span className="ml-2 text-amber-600">(échantillon limité à 200)</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHiddenPage((p) => Math.max(0, p - 1))}
                  disabled={hiddenPage === 0}
                  className="rounded border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-40"
                >
                  Préc.
                </button>
                <button
                  onClick={() => setHiddenPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={hiddenPage >= totalPages - 1}
                  className="rounded border border-border bg-background px-2 py-1 hover:bg-muted disabled:opacity-40"
                >
                  Suiv.
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Note : un même produit peut compter dans plusieurs raisons (par exemple sans catégorie
        ET sur catégorie désactivée). Les totaux « visibles » sont bornés par le nombre total
        d'enregistrements actifs pour rester cohérents.
      </p>
    </div>
  );
};

const ReasonRow = ({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint?: string;
  tone: "good" | "warn" | "danger" | "neutral";
}) => {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-destructive"
          : "text-muted-foreground";
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <Icon size={16} className={`mt-0.5 ${toneClass}`} />
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <div className="text-base font-semibold tabular-nums text-foreground">{fmt(value)}</div>
    </div>
  );
};

export default AdminCatalogDiagnostics;
