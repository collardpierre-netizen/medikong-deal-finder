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

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["admin-home-showcase-settings"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("home_showcase_settings")
        .select("pinned_product_id, updated_at, updated_by")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as { pinned_product_id: string | null; updated_at: string; updated_by: string | null } | null;
    },
  });

  const pinnedId = settings?.pinned_product_id ?? null;

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
    mutationFn: async (productId: string | null) => {
      const { error } = await sb
        .from("home_showcase_settings")
        .update({ pinned_product_id: productId })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: (_d, productId) => {
      toast.success(productId ? "Produit épinglé mis à jour" : "Produit épinglé retiré");
      setSearch("");
      qc.invalidateQueries({ queryKey: ["admin-home-showcase-settings"] });
      qc.invalidateQueries({ queryKey: ["home-showcase-settings"] });
      qc.invalidateQueries({ queryKey: ["featured-price-delta"] });
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

      {/* Currently pinned */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Produit actuellement épinglé</h3>
          {updatedAtLabel && (
            <span className="text-xs text-muted-foreground">
              Mis à jour le {updatedAtLabel}
            </span>
          )}
        </div>

        {loadingSettings ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : pinnedProduct ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="h-14 w-14 shrink-0 rounded bg-white border flex items-center justify-center overflow-hidden">
              {pinnedProduct.image_url ? (
                <img
                  src={pinnedProduct.image_url}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{pinnedProduct.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {pinnedProduct.brand_name ?? "—"}
                {pinnedProduct.gtin ? ` · GTIN ${pinnedProduct.gtin}` : ""}
                {pinnedProduct.is_active ? "" : " · ⚠️ inactif"}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/produit/${pinnedProduct.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPinned.mutate(null)}
              disabled={setPinned.isPending}
            >
              <X className="mr-1 h-4 w-4" /> Retirer
            </Button>
          </div>
        ) : pinnedId ? (
          <div className="text-sm text-amber-600">
            Produit introuvable (id <code>{pinnedId}</code>). Choisissez-en un autre ci-dessous.
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Aucun produit épinglé. La home affichera automatiquement le SKU avec le plus gros écart de prix du jour.
          </div>
        )}
      </div>

      {/* Picker */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div>
          <Label htmlFor="product-search" className="text-sm font-semibold">
            Choisir un nouveau produit épinglé
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Recherche par <strong>GTIN</strong> (ex&nbsp;: <code>3337875852302</code>) ou par <strong>nom</strong> (min. 2 caractères). Privilégiez un produit multi-vendeurs avec un écart de prix net.
          </p>
        </div>

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
                const already = p.id === pinnedId;
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
                      onClick={() => setPinned.mutate(p.id)}
                    >
                      {already ? "Déjà épinglé" : "Épingler"}
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
