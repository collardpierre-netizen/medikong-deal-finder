import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface VendorTopBrandsProps {
  vendorId: string;
  vendorSlug?: string;
  limit?: number;
}

type TopBrand = {
  brand_id: string;
  brand_name: string;
  brand_slug: string | null;
  brand_logo_url: string | null;
  offer_count: number;
};

export function VendorTopBrands({ vendorId, vendorSlug, limit = 12 }: VendorTopBrandsProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendor-top-brands", vendorId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_top_brands", {
        _vendor_id: vendorId,
        _limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as TopBrand[];
    },
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return null;
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="border-b border-border bg-background">
      <div className="mk-container py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles size={12} className="text-primary" />
            Marques phares
          </h2>
          {!isLoading && data && data.length >= limit && (
            <span className="text-[11px] text-muted-foreground">Top {limit}</span>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[120px] h-[88px] rounded-lg border border-border bg-muted/40 animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))
            : data!.map((b) => {
                const href = vendorSlug && b.brand_slug
                  ? `/vendeurs/${vendorSlug}?brand=${b.brand_slug}`
                  : b.brand_slug
                  ? `/marques/${b.brand_slug}`
                  : "#";
                return (
                  <Link
                    key={b.brand_id}
                    to={href}
                    className="group shrink-0 w-[120px] h-[88px] rounded-lg border border-border bg-card hover:border-primary hover:shadow-sm transition-all flex flex-col items-center justify-center p-2 gap-1.5"
                    title={`${b.brand_name} · ${b.offer_count} offre${b.offer_count > 1 ? "s" : ""}`}
                  >
                    {b.brand_logo_url ? (
                      <img
                        src={b.brand_logo_url}
                        alt={b.brand_name}
                        loading="lazy"
                        className="max-h-8 max-w-[90px] object-contain"
                      />
                    ) : (
                      <div className="h-8 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {b.brand_name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-[11px] text-foreground text-center line-clamp-1 group-hover:text-primary">
                      {b.brand_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {b.offer_count} offre{b.offer_count > 1 ? "s" : ""}
                    </span>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
