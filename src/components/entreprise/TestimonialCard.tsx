import { Star } from "lucide-react";
import type { Testimonial } from "@/data/entreprise-data";

export function TestimonialCard({ stars, text, authorName, authorRole, avatarInitials, avatarGradient }: Testimonial) {
  return (
    <div className="p-8 rounded-2xl border border-border bg-white hover:shadow-lg hover:border-transparent transition-all">
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < stars ? "text-[#F59E0B] fill-[#F59E0B]" : "text-border"}`} />
        ))}
      </div>
      <p className="text-[15px] italic text-foreground leading-relaxed mb-6">"{text}"</p>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-sm font-bold text-white`}>
          {avatarInitials}
        </div>
        <div>
          <p className="text-sm font-bold text-[#1E293B]">{authorName}</p>
          <p className="text-xs text-muted-foreground">{authorRole}</p>
        </div>
      </div>
    </div>
  );
}
