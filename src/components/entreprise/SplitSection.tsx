import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Check } from "lucide-react";

interface SplitSectionProps {
  tag?: { label: string; color: string; bg: string };
  title: string;
  paragraphs: string[];
  checklist?: string[];
  imagePlaceholder: string;
  imageGradient: string;
  reverse?: boolean;
}

export function SplitSection({ tag, title, paragraphs, checklist, imagePlaceholder, imageGradient, reverse }: SplitSectionProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className={reverse ? "md:order-last" : ""}>
        {tag && (
          <span
            className="inline-block px-3 py-1 rounded-md text-xs font-semibold mb-4"
            style={{ color: tag.color, backgroundColor: tag.bg }}
          >
            {tag.label}
          </span>
        )}
        <h3 className="text-2xl md:text-[28px] font-bold text-[#1E293B] leading-tight tracking-tight mb-4">{title}</h3>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-base text-muted-foreground leading-relaxed mb-4">{p}</p>
        ))}
        {checklist && (
          <ul className="space-y-2.5 mt-4">
            {checklist.map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-mk-navy">
                <Check size={16} className="text-mk-green shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br ${imageGradient} flex items-center justify-center`}>
        <span className="text-sm text-white/70 px-6 text-center">{imagePlaceholder}</span>
      </div>
    </div>
  );
}
