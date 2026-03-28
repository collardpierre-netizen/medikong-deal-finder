import { icons } from "lucide-react";
import { categoryIconMap } from "@/lib/vendor-tokens";

interface VProductIconProps {
  cat: string;
  size?: number;
}

export function VProductIcon({ cat, size = 32 }: VProductIconProps) {
  const mapping = categoryIconMap[cat] || { icon: "Package", color: "#616B7C" };
  const Icon = icons[mapping.icon as keyof typeof icons] || icons.Package;

  return (
    <div
      className="flex items-center justify-center rounded-[25%]"
      style={{
        width: size,
        height: size,
        backgroundColor: mapping.color + "14",
      }}
    >
      <Icon size={size * 0.5} style={{ color: mapping.color }} />
    </div>
  );
}
