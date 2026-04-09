import { useScrollReveal } from "@/hooks/useScrollReveal";

interface SectionProps {
  label?: string;
  title?: string;
  subtitle?: string;
  bg?: "white" | "gray" | "warm";
  children: React.ReactNode;
}

const bgMap = {
  white: "bg-white",
  gray: "bg-[#F8FAFC]",
  warm: "bg-[#FFF7ED]",
};

export function Section({ label, title, subtitle, bg = "white", children }: SectionProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className={bgMap[bg]}>
      <div
        ref={ref}
        className={`max-w-[1200px] mx-auto px-6 md:px-12 py-16 md:py-20 transition-all duration-700 ease-expressive ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {label && (
          <p className="text-xs font-bold uppercase tracking-[1.5px] text-[#E70866] text-center mb-3">{label}</p>
        )}
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[#1E293B] text-center tracking-tight leading-tight mb-4">{title}</h2>
        )}
        {subtitle && (
          <p className="text-[15px] md:text-[17px] text-muted-foreground text-center max-w-[600px] mx-auto mb-12">{subtitle}</p>
        )}
        {children}
      </div>
    </section>
  );
}
