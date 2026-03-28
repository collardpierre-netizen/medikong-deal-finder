import { ExternalLink } from "lucide-react";
import type { PressArticle } from "@/data/entreprise-data";

export function PressCard({ source, title, excerpt, date, thumbnailGradient, articleUrl }: PressArticle) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 md:gap-6 p-5 md:p-6 rounded-2xl border border-border bg-white hover:shadow-lg hover:border-transparent transition-all mb-4">
      <div className={`aspect-[16/10] rounded-[10px] bg-gradient-to-br ${thumbnailGradient} flex items-center justify-center`}>
        <span className="text-white/60 text-xs font-bold uppercase tracking-wide">{source}</span>
      </div>
      <div>
        <p className="text-xs font-bold text-[#E70866] tracking-wide mb-1.5">{source}</p>
        <h4 className="text-base font-bold text-[#1E293B] leading-tight mb-1.5">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{excerpt}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94A3B8]">{date}</span>
          <a href={articleUrl} className="text-[#1B5BDA] text-sm font-semibold hover:underline inline-flex items-center gap-1">
            Lire <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
