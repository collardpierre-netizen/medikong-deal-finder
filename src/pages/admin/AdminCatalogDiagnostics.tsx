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
