import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, AlertCircle, Search, Globe, Package, EyeOff } from "lucide-react";

type CountryStats = {
  country: string;
  activeProducts: number;
  withCountryStats: number;
  withoutOffers: number;
  offersActive: number;
  offersWithCountry: number;
  offersWithoutCountry: number;
};

type RecentRun = {
  id: string;
  run_at: string;
  country_code: string;
  active_products_count: number;
  missing_offers_count: number;
  missing_ratio: number;
};

const COUNTRIES = ["BE", "FR", "LU"] as const;

const fmt = (n: number) => n.toLocaleString("fr-FR");

async function loadStats(country: string): Promise<CountryStats> {
  const head = { count: "exact" as const, head: true };

  const [
    { count: activeProducts },
    { count: withCountryStats },
    { count: offersActive },
    { count: offersWithCountry },
    { count: offersWithoutCountry },
  ] = await Promise.all([
    supabase.from("products").select("id", head).eq("is_active", true),
    supabase
      .from("products_with_country_stats_v")
      .select("id", head)
      .eq("is_active", true)
      .eq("country_code", country)
      .gt("country_offer_count", 0),
    supabase.from("offers").select("id", head).eq("is_active", true),
    supabase.from("offers").select("id", head).eq("is_active", true).eq("country_code", country),
    supabase.from("offers").select("id", head).eq("is_active", true).is("country_code", null),
  ]);

  const totalActive = activeProducts ?? 0;
  const withStats = withCountryStats ?? 0;

  return {
    country,
    activeProducts: totalActive,
    withCountryStats: withStats,
    withoutOffers: Math.max(0, totalActive - withStats),
    offersActive: offersActive ?? 0,
    offersWithCountry: offersWithCountry ?? 0,
    offersWithoutCountry: offersWithoutCountry ?? 0,
  };
}

const Tile = ({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) => {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : tone === "warn"
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : tone === "danger"
          ? "text-destructive bg-destructive/10 border-destructive/30"
          : "text-foreground bg-muted/40 border-border";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{typeof value === "number" ? fmt(value) : value}</div>
      {hint && <div className="mt-1 text-xs opacity-75">{hint}</div>}
    </div>
  );
};

const AdminSearchDebug = () => {
  const [rows, setRows] = useState<CountryStats[]>([]);
  const [recent, setRecent] = useState<RecentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Quick search probe
  const [term, setTerm] = useState("");
  const [country, setCountry] = useState<string>("BE");
  const [probe, setProbe] = useState<{
    matchingProducts: number;
    matchingActive: number;
    matchingWithCountryOffers: number;
  } | null>(null);
  const [probing, setProbing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await Promise.all(COUNTRIES.map((c) => loadStats(c)));
      setRows(all);

      const { data: runs } = await supabase
        .from("catalog_health_runs")
        .select("id, run_at, country_code, active_products_count, missing_offers_count, missing_ratio")
        .order("run_at", { ascending: false })
        .limit(15);
      setRecent((runs ?? []) as RecentRun[]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const runSnapshot = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.rpc("log_active_products_without_offers");
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  };

  const runProbe = async () => {
    if (!term.trim()) return;
    setProbing(true);
    setProbe(null);
    try {
      const head = { count: "exact" as const, head: true };
      const pattern = `%${term.trim()}%`;
      const [{ count: any1 }, { count: active1 }, { count: countryHit }] = await Promise.all([
        supabase.from("products").select("id", head).ilike("name", pattern),
        supabase.from("products").select("id", head).eq("is_active", true).ilike("name", pattern),
        supabase
          .from("products_with_country_stats_v")
          .select("id", head)
          .eq("is_active", true)
          .eq("country_code", country)
          .gt("country_offer_count", 0)
          .ilike("name", pattern),
      ]);
      setProbe({
        matchingProducts: any1 ?? 0,
        matchingActive: active1 ?? 0,
        matchingWithCountryOffers: countryHit ?? 0,
      });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Debug recherche & visibilité pays</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compteurs temps réel pour comprendre pourquoi une recherche peut renvoyer 0 résultat sur un pays donné.
            Voir aussi{" "}
            <Link to="/admin/catalog-diagnostics" className="underline">
              Diagnostic catalogue
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runSnapshot}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {running ? "Snapshot…" : "Lancer un snapshot"}
          </button>
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

      {/* Per-country counters */}
      <section className="space-y-4">
        {rows.map((r) => {
          const ratio = r.activeProducts > 0 ? Math.round((r.withCountryStats / r.activeProducts) * 100) : 0;
          const tone = ratio >= 80 ? "good" : ratio >= 40 ? "warn" : "danger";
          return (
            <div key={r.country} className="rounded-lg border border-border bg-card p-4">
              <header className="mb-3 flex items-center gap-2">
                <Globe size={16} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Pays {r.country}</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  Couverture pays : <strong className="text-foreground">{ratio}%</strong>
                </span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Tile label="Produits actifs" value={r.activeProducts} />
                <Tile
                  label={`Avec offres ${r.country}`}
                  value={r.withCountryStats}
                  hint={`${ratio}% du total`}
                  tone={tone}
                />
                <Tile
                  label={`Sans offre ${r.country}`}
                  value={r.withoutOffers}
                  hint="produits actifs sans stats pays"
                  tone={r.withoutOffers > 0 ? "warn" : "good"}
                />
                <Tile label="Offres actives (total)" value={r.offersActive} />
                <Tile label={`Offres ${r.country}`} value={r.offersWithCountry} />
                <Tile label="Offres country=NULL" value={r.offersWithoutCountry} hint="fallback global" />
              </div>
            </div>
          );
        })}
      </section>

      {/* Probe */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <Search size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Tester un terme de recherche</h2>
        </header>
        <div className="flex flex-wrap gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="ex: heka, fresubin, dafalgan…"
            className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === "Enter" && runProbe()}
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                Pays : {c}
              </option>
            ))}
          </select>
          <button
            onClick={runProbe}
            disabled={probing || !term.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {probing ? "Analyse…" : "Analyser"}
          </button>
        </div>
        {probe && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Matches (tous produits)" value={probe.matchingProducts} />
            <Tile
              label="Matches actifs"
              value={probe.matchingActive}
              tone={probe.matchingActive > 0 ? "good" : "danger"}
            />
            <Tile
              label={`Matches avec offres ${country}`}
              value={probe.matchingWithCountryOffers}
              tone={probe.matchingWithCountryOffers > 0 ? "good" : "warn"}
              hint={
                probe.matchingActive > 0 && probe.matchingWithCountryOffers === 0
                  ? "→ produits actifs mais aucune offre pays : recherche affichera 0 sans fallback"
                  : undefined
              }
            />
          </div>
        )}
      </section>

      {/* Recent snapshots */}
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <EyeOff size={16} /> Historique des snapshots backend (catalog_health_runs)
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Pays</th>
                <th className="px-4 py-2 text-right">Actifs</th>
                <th className="px-4 py-2 text-right">Sans offre</th>
                <th className="px-4 py-2 text-right">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Aucun snapshot. Cliquez sur « Lancer un snapshot ».
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(r.run_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 font-medium">{r.country_code}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.active_products_count)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.missing_offers_count)}</td>
                  <td className="px-4 py-2 text-right">
                    {(Number(r.missing_ratio) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminSearchDebug;
