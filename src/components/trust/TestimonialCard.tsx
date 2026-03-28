import type { TestimonialData } from "@/data/trust-process-data";

export function TestimonialCard({ quote, authorName, authorRole, authorInitials }: TestimonialData) {
  return (
    <div className="bg-white border border-mk-line rounded-2xl p-7 md:p-8">
      <p className="text-sm md:text-base text-foreground leading-relaxed italic pl-5 border-l-[3px] border-mk-blue mb-6">
        « {quote} »
      </p>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-[#F8FAFC] flex items-center justify-center text-base font-bold text-mk-blue shrink-0">
          {authorInitials}
        </div>
        <div>
          <div className="text-sm font-bold text-mk-navy">{authorName}</div>
          <div className="text-xs text-muted-foreground">{authorRole}</div>
        </div>
      </div>
    </div>
  );
}
