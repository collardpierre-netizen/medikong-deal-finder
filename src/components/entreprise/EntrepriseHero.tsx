import { Button } from "@/components/ui/button";

type HeroVariant = "dark" | "warm" | "pink" | "image";

interface EntrepriseHeroProps {
  variant: HeroVariant;
  badge?: string;
  title: string;
  subtitle: string;
  cta?: { label: string; onClick?: () => void; variant: "pink" | "white" | "outline" }[];
}

const bgMap: Record<HeroVariant, string> = {
  dark: "bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155] text-white",
  warm: "bg-gradient-to-br from-[#FFF7ED] via-[#FEF3C7] to-[#FECDD3] text-[#1E293B]",
  pink: "bg-gradient-to-br from-[#E70866] via-[#DB2777] to-[#9333EA] text-white",
  image: "bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#334155] text-white",
};

export function EntrepriseHero({ variant, badge, title, subtitle, cta }: EntrepriseHeroProps) {
  return (
    <section className={`${bgMap[variant]} min-h-[420px] flex items-center`}>
      <div className="mk-container py-20 md:py-24 text-center w-full">
        {badge && (
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide mb-6 bg-white/15 backdrop-blur-sm">
            {badge}
          </span>
        )}
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.12] mb-5 max-w-[800px] mx-auto">
          {title}
        </h1>
        <p className="text-base md:text-lg leading-relaxed max-w-[720px] mx-auto opacity-80 mb-8">
          {subtitle}
        </p>
        {cta && cta.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {cta.map((c) => (
              <Button
                key={c.label}
                onClick={c.onClick}
                className={
                  c.variant === "pink"
                    ? "bg-[#E70866] hover:bg-[#C70758] text-white px-6 h-11"
                    : c.variant === "white"
                    ? "bg-white text-[#1E293B] hover:bg-white/90 px-6 h-11"
                    : "border-2 border-white/40 bg-transparent text-white hover:bg-white/10 px-6 h-11"
                }
              >
                {c.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
