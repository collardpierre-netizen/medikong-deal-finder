/**
 * /admin/cms/home/comparaison
 *
 * Configure le produit épinglé dans l'encart "Comparaison live" du hero
 * de la home (composant `PriceDeltaShowcase`). Singleton stocké dans
 * `home_showcase_settings`.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, Search, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sb = supabase as any;

type ProductLite = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  brand_name: string | null;
  gtin: string | null;
  is_active: boolean;
};

const AdminCmsHomeShowcase = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const [slot, setSlot] = useState<"pinned" | "demo_cta">("pinned");

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["admin-home-showcase-settings"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("home_showcase_settings")
        .select(
          "pinned_product_id, demo_cta_product_id, pinned_product_gtin, demo_cta_product_gtin, updated_at, updated_by",
        )
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as {
        pinned_product_id: string | null;
        demo_cta_product_id: string | null;
        pinned_product_gtin: string | null;
        demo_cta_product_gtin: string | null;
        updated_at: string;
        updated_by: string | null;
      } | null;
    },
  });

  const pinnedId = settings?.pinned_product_id ?? null;
  const demoCtaId = settings?.demo_cta_product_id ?? null;
  const pinnedGtin = settings?.pinned_product_gtin ?? null;
  const demoCtaGtin = settings?.demo_cta_product_gtin ?? null;

  const { data: pinnedProduct } = useQuery({
    queryKey: ["admin-home-showcase-pinned", pinnedId],
    enabled: !!pinnedId,
    queryFn: async (): Promise<ProductLite | null> => {
      const { data, error } = await sb
        .from("products")
        .select("id, name, slug, image_url, brand_name, gtin, is_active")
        .eq("id", pinnedId)
        .maybeSingle();
      if (error) throw error;
      return data as ProductLite | null;
    },
  });

  const { data: demoCtaProduct } = useQuery({
    queryKey: ["admin-home-showcase-demo-cta", demoCtaId],
    enabled: !!demoCtaId,
    queryFn: async (): Promise<ProductLite | null> => {
      const { data, error } = await sb
        .from("products")
        .select("id, name, slug, image_url, brand_name, gtin, is_active")
        .eq("id", demoCtaId)
        .maybeSingle();
      if (error) throw error;
      return data as ProductLite | null;
    },
  });

  const term = search.trim();
  const isGtin = /^\d{6,14}$/.test(term);

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["admin-home-showcase-search", term],
    enabled: term.length >= 2,
    queryFn: async (): Promise<ProductLite[]> => {
      let q = sb
        .from("products")
        .select("id, name, slug, image_url, brand_name, gtin, is_active")
        .eq("is_active", true)
        .limit(20);
      if (isGtin) {
        q = q.eq("gtin", term);
      } else {
        q = q.ilike("name", `%${term}%`).order("name");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductLite[];
    },
  });

  const setPinned = useMutation({
    mutationFn: async (vars: { slot: "pinned" | "demo_cta"; productId: string | null }) => {
      const column = vars.slot === "pinned" ? "pinned_product_id" : "demo_cta_product_id";
      const { error } = await sb
        .from("home_showcase_settings")
        .update({ [column]: vars.productId })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      const label = vars.slot === "pinned" ? "Produit comparaison" : "Produit CTA démo";
      toast.success(vars.productId ? `${label} mis à jour` : `${label} retiré`);
      setSearch("");
      qc.invalidateQueries({ queryKey: ["admin-home-showcase-settings"] });
      qc.invalidateQueries({ queryKey: ["home-showcase-settings"] });
      qc.invalidateQueries({ queryKey: ["featured-price-delta"] });
      qc.invalidateQueries({ queryKey: ["home-demo-cta-product"] });
    },
    onError: (err: any) =>
      toast.error("Mise à jour impossible : " + (err?.message || "erreur inconnue")),
  });

  const updatedAtLabel = useMemo(() => {
    if (!settings?.updated_at) return null;
    try {
      return new Intl.DateTimeFormat("fr-BE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(settings.updated_at));
    } catch {
      return settings.updated_at;
    }
  }, [settings?.updated_at]);

  // Analytics KPIs
  const [periodDays, setPeriodDays] = useState<number>(30);
  const { data: kpis = [], isLoading: loadingKpis } = useQuery({
    queryKey: ["admin-home-showcase-kpis", periodDays],
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_home_showcase_kpis", { _days: periodDays });
      if (error) throw error;
      return (data ?? []) as Array<{
        product_id: string | null;
        product_name: string | null;
        product_slug: string | null;
        variant: string;
        impressions: number;
        clicks: number;
        ctr: number;
        last_seen: string;
      }>;
    },
  });

  const totals = useMemo(() => {
    const impr = kpis.reduce((s, r) => s + Number(r.impressions || 0), 0);
    const clk = kpis.reduce((s, r) => s + Number(r.clicks || 0), 0);
    return {
      impressions: impr,
      clicks: clk,
      ctr: impr > 0 ? Math.round((clk / impr) * 10000) / 100 : 0,
    };
  }, [kpis]);

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Comparaison live — Home"
        subtitle="Produit épinglé dans l'encart « Exemple de comparaison live » sous le hero. Si vide, la home retombe sur le top écart de prix automatique."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/cms">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour CMS
            </Link>
          </Button>
        }
      />

      {/* Analytics */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold">Analytics — impressions, clics, CTR</h3>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPeriodDays(d)}
                className={`px-2.5 py-1 text-xs rounded ${
                  periodDays === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Impressions</div>
            <div className="text-xl font-semibold tabular-nums">
              {totals.impressions.toLocaleString("fr-BE")}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Clics</div>
            <div className="text-xl font-semibold tabular-nums">
              {totals.clicks.toLocaleString("fr-BE")}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">CTR</div>
            <div className="text-xl font-semibold tabular-nums">{totals.ctr}%</div>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Produit</th>
                <th className="text-left px-3 py-2">Variante</th>
                <th className="text-right px-3 py-2">Impr.</th>
                <th className="text-right px-3 py-2">Clics</th>
                <th className="text-right px-3 py-2">CTR</th>
                <th className="text-left px-3 py-2">Dernière vue</th>
              </tr>
            </thead>
            <tbody>
              {loadingKpis ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-muted-foreground">Chargement…</td>
                </tr>
              ) : kpis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-muted-foreground">
                    Aucun événement enregistré sur la période.
                  </td>
                </tr>
              ) : (
                kpis.map((r, i) => (
                  <tr key={`${r.product_id ?? "none"}-${r.variant}-${i}`} className="border-t">
                    <td className="px-3 py-2">
                      {r.product_slug ? (
                        <Link
                          to={`/produit/${r.product_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {r.product_name ?? r.product_id}
                        </Link>
                      ) : (
                        r.product_name ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[11px]">
                        {r.variant}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(r.impressions).toLocaleString("fr-BE")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(r.clicks).toLocaleString("fr-BE")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(r.ctr).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.last_seen ? new Date(r.last_seen).toLocaleString("fr-BE") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Currently configured products */}
      {(["pinned", "demo_cta"] as const).map((s) => {
        const isPinned = s === "pinned";
        const product = isPinned ? pinnedProduct : demoCtaProduct;
        const currentId = isPinned ? pinnedId : demoCtaId;
        const title = isPinned
          ? "Encart « Comparaison live » (produit épinglé)"
          : 'CTA « Voir un exemple de comparaison »';
        const emptyHint = isPinned
          ? "Aucun produit épinglé. La home affichera automatiquement le SKU avec le plus gros écart de prix du jour."
          : "Aucun produit configuré pour le CTA. La home retombera sur le top écart de prix du jour.";
        return (
          <div key={s} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{title}</h3>
              {isPinned && updatedAtLabel && (
                <span className="text-xs text-muted-foreground">
                  Mis à jour le {updatedAtLabel}
                </span>
              )}
            </div>

            {loadingSettings ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : product ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="h-14 w-14 shrink-0 rounded bg-white border flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{product.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {product.brand_name ?? "—"}
                    {product.gtin ? ` · GTIN ${product.gtin}` : ""}
                    {product.is_active ? "" : " · ⚠️ inactif"}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/produit/${product.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPinned.mutate({ slot: s, productId: null })}
                  disabled={setPinned.isPending}
                >
                  <X className="mr-1 h-4 w-4" /> Retirer
                </Button>
              </div>
            ) : currentId ? (
              <div className="text-sm text-amber-600">
                Produit introuvable (id <code>{currentId}</code>). Choisissez-en un autre ci-dessous.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{emptyHint}</div>
            )}
          </div>
        );
      })}

      {/* Picker */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label htmlFor="product-search" className="text-sm font-semibold">
            Choisir un produit pour {slot === "pinned" ? "l'encart comparaison" : "le CTA démo"}
          </Label>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {([
              { v: "pinned", label: "Encart comparaison" },
              { v: "demo_cta", label: "CTA démo" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setSlot(opt.v)}
                className={`px-2.5 py-1 text-xs rounded ${
                  slot === opt.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Recherche par <strong>GTIN</strong> (ex&nbsp;: <code>4051895033402</code>) ou par <strong>nom</strong> (min. 2 caractères).
          Pour l'encart comparaison, privilégiez un produit multi-vendeurs avec un écart de prix net.
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="product-search"
            placeholder="GTIN ou nom de produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {term.length >= 2 && (
          <div className="max-h-96 overflow-y-auto rounded border bg-background">
            {searching ? (
              <div className="p-3 text-sm text-muted-foreground">Recherche…</div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                Aucun résultat{isGtin ? ` pour le GTIN ${term}` : ""}.
              </div>
            ) : (
              searchResults.map((p) => {
                const currentId = slot === "pinned" ? pinnedId : demoCtaId;
                const already = p.id === currentId;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
                  >
                    <div className="h-10 w-10 shrink-0 rounded bg-white border flex items-center justify-center overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-contain p-1" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {p.brand_name ?? "—"}
                        {p.gtin ? ` · GTIN ${p.gtin}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={already ? "outline" : "default"}
                      disabled={already || setPinned.isPending}
                      onClick={() => setPinned.mutate({ slot, productId: p.id })}
                    >
                      {already ? "Déjà sélectionné" : "Sélectionner"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCmsHomeShowcase;
