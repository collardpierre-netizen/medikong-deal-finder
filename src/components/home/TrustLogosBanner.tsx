import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrustLogo {
  name: string;
  website_url: string | null;
  logo_url: string | null;
  domain: string | null;
}

interface Props {
  placement?: string;
  eyebrow?: string;
  title?: string;
  className?: string;
}

function resolveSrc(l: TrustLogo): string {
  if (l.logo_url && l.logo_url.trim()) return l.logo_url.trim();
  if (l.domain && l.domain.trim()) return `https://logo.clearbit.com/${l.domain.trim()}?size=128`;
  return "";
}

export default function TrustLogosBanner({
  placement = "invest",
  eyebrow = "Ils nous font confiance",
  title = "Des acteurs majeurs de la santé en Belgique",
  className = "",
}: Props) {
  const { data: logos = [] } = useQuery<TrustLogo[]>({
    queryKey: ["cms-partner-logos", placement],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cms_partner_logos")
        .select("name, website_url, logo_url, domain, sort_order")
        .eq("placement", placement)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as TrustLogo[];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!logos.length) return null;

  return (
    <section className={`py-12 bg-mk-alt border-y border-mk-line overflow-hidden ${className}`}>
      <div className="max-w-5xl mx-auto px-5 text-center mb-8">
        <p className="text-xs font-semibold text-mk-sec uppercase tracking-widest mb-1">{eyebrow}</p>
        <h3 className="text-lg font-bold text-mk-navy">{title}</h3>
      </div>
      <div className="relative">
        <div className="flex animate-[marquee_30s_linear_infinite] gap-12 items-center">
          {[...logos, ...logos].map((logo, i) => {
            const src = resolveSrc(logo);
            return (
              <a
                key={`${logo.name}-${i}`}
                href={logo.website_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
                title={logo.name}
              >
                <img
                  src={src}
                  alt={logo.name}
                  loading="lazy"
                  className="h-10 md:h-12 w-auto object-contain"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.onerror = null;
                    const txt = encodeURIComponent(logo.name);
                    el.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='48'><rect width='100%25' height='100%25' fill='%23F1F5F9' rx='6'/><text x='50%25' y='55%25' text-anchor='middle' font-family='system-ui,sans-serif' font-size='14' font-weight='600' fill='%231E252F'>${txt}</text></svg>`;
                  }}
                />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
