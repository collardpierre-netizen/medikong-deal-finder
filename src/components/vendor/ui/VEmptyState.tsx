import { icons } from "lucide-react";

interface VEmptyStateProps {
  icon: keyof typeof icons;
  title: string;
  sub?: string;
}

export function VEmptyState({ icon, title, sub }: VEmptyStateProps) {
  const Icon = icons[icon];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={48} className="text-[#CBD5E1] mb-4" />}
      <p className="text-[15px] font-semibold text-[#1D2530]">{title}</p>
      {sub && <p className="text-[13px] text-[#616B7C] mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}
