import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Loader2, Lock, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { useIsResellerPro } from "@/hooks/useCurrentBuyerProfile";
import { ResellerPriceBadge } from "@/components/pro/ResellerPriceBadge";
import { formatEur } from "@/lib/price-format";
import { getProductImageSrc } from "@/lib/image-utils";
import { Layout } from "@/components/layout/Layout";

type ResellerOfferRow = {
  offer_id: string;
  product_id: string;
  vendor_id: string;
  price_excl_vat: number;
  price_source: string;
  moq: number | null;
  mov_amount: number | null;
  stock_quantity: number | null;
  country_code: string | null;
};

type EnrichedRow = ResellerOfferRow & {
  product?: {
    id: string;
    slug: string | null;
    name: string;
    brand_name: string | null;
    image_urls: string[] | null;
  };
};

function AccessDenied({ reason }: { reason: "anon" | "no-profile" }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4">
        <Lock size={26} aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Espace revendeur</h1>
      <p className="text-muted-foreground mb-6">
        {reason === "anon"
          ? "Cet espace est réservé aux comptes professionnels validés comme revendeurs."
          : "Votre compte n'est pas (encore) marqué comme revendeur professionnel. Contactez-nous pour activer l'accès au catalogue inter-vendeurs."}
      </p>
      <div className="flex gap-3 justify-center">
        {reason === "anon" ? (
          <Link to="/connexion" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
            Se connecter
          </Link>
        ) : (
          <a
            href="mailto:hello@medikong.pro?subject=Acc%C3%A8s%20revendeur%20pro"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Demander l'accès
          </a>
        )}
        <Link to="/catalogue" className="px-4 py-2 rounded-lg border border-input text-sm font-semibold">
          Voir le catalogue public
        </Link>
      </div>
    </div>
  );
}

export default function ProPage() {
  const { user } = useAuth();
  const { isReseller, isLoading: profileLoading } = useIsResellerPro();
  const { country: selectedCountry } = useCountry();
  const [search, setSearch] = useState("");

  const offersQuery = useQuery({
    queryKey: ["reseller-offers", selectedCountry, isReseller],
    enabled: !!user && isReseller,
    queryFn: async (): Promise<EnrichedRow[]> => {
      const { data, error } = await supabase.rpc("list_reseller_offers", {
        _country: selectedCountry || null,
        _limit: 200,
        _offset: 0,
      });
      if (error) throw error;
      const rows = (data ?? []) as ResellerOfferRow[];
      if (rows.length === 0) return [];
      const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
      const { data: products } = await supabase
        .from("products")
        .select("id, slug, name, brand_name, image_urls")
        .in("id", productIds);
      const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
      return rows.map((r) => ({ ...r, product: byId.get(r.product_id) as EnrichedRow["product"] }));
    },
    staleTime: 60 * 1000,
  });

  const filtered = useMemo(() => {
    const list = offersQuery.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.product?.name?.toLowerCase().includes(q) ||
        r.product?.brand_name?.toLowerCase().includes(q)
    );
  }, [offersQuery.data, search]);

  const inner = (() => {
    if (profileLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      );
    }
    if (!user) return <AccessDenied reason="anon" />;
    if (!isReseller) return <AccessDenied reason="no-profile" />;

    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-2">
            <Lock size={10} /> Espace revendeur
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogue revendeur</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Offres B2B confidentielles publiées par des vendeurs MediKong à destination des revendeurs vérifiés. Les prix
            affichés ne sont visibles que par votre compte.
          </p>
        </header>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="search"
            placeholder="Rechercher un produit, une marque…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        </div>

        {offersQuery.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : offersQuery.error ? (
          <div className="text-sm text-destructive">Erreur de chargement des offres revendeur.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm border border-dashed rounded-xl">
            Aucune offre revendeur disponible
            {selectedCountry ? ` pour ${selectedCountry}` : ""} pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((row) => (
              <article
                key={row.offer_id}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <Link to={row.product?.slug ? `/produit/${row.product.slug}` : "#"} className="block">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                    <img
                      src={pickProductImageSrc(row.product)}
                      alt={row.product?.name ?? "Produit"}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{row.product?.brand_name ?? "—"}</p>
                  <p className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{row.product?.name ?? "Produit"}</p>
                </Link>
                <div className="mt-auto space-y-1.5">
                  <ResellerPriceBadge source={row.price_source} />
                  <div className="text-lg font-bold text-primary">
                    {formatEur(Number(row.price_excl_vat))} <span className="text-[11px] font-medium text-muted-foreground">HTVA</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                    {row.moq != null && row.moq > 1 && <span>MOQ {row.moq}</span>}
                    {row.mov_amount != null && Number(row.mov_amount) > 0 && (
                      <span>MOV {formatEur(Number(row.mov_amount))}</span>
                    )}
                    {row.stock_quantity != null && <span>Stock {row.stock_quantity}</span>}
                    {row.country_code && <span>{row.country_code}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  })();

  return (
    <Layout>
      <Helmet>
        <title>Espace revendeur — MediKong</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      {inner}
    </Layout>
  );
}
