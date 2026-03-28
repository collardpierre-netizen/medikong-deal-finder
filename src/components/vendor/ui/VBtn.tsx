import { cn } from "@/lib/utils";
import { icons } from "lucide-react";

interface VBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
  small?: boolean;
  icon?: keyof typeof icons;
  children?: React.ReactNode;
}

export function VBtn({ primary, small, icon, children, className, ...props }: VBtnProps) {
  const Icon = icon ? icons[icon] : null;
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
        small ? "text-xs px-3 py-1.5" : "text-[13px] px-4 py-2",
        primary
          ? "bg-[#1B5BDA] text-white hover:bg-[#1747b0]"
          : "bg-white border border-[#E2E8F0] text-[#1D2530] hover:bg-[#F1F5F9]",
        className
      )}
      {...props}
    >
      {Icon && <Icon size={small ? 14 : 16} />}
      {children}
    </button>
  );
}
