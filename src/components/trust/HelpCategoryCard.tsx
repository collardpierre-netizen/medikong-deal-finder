import type { HelpCategoryData } from "@/data/trust-process-data";

export function HelpCategoryCard({ icon: Icon, title, description, articleCount }: HelpCategoryData) {
  return (
    <div className="bg-white border border-mk-line rounded-2xl p-6 md:p-7 cursor-pointer hover:border-mk-blue hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
      <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4">
        <Icon size={22} className="text-[#1B6(5BDA]" />
      </div>
      <h3 className="text-base font-bold text-mk-navy mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      <p className="text-xs font-semibold text-mk-blue mt-3">{articleCount} articles</p>
    </div>
  );
}
