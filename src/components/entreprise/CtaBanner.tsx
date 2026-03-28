import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CtaBannerProps {
  variant: "dark" | "blue" | "light";
  title: string;
  subtitle?: string;
  buttons: { label: string; variant: "blue" | "outline" | "white"; to?: string }[];
}

export function CtaBanner({ variant, title, subtitle, buttons }: CtaBannerProps) {
  const navigate = useNavigate();

  const bgClass = variant === "light"
    ? "bg-[#F8FAFC] text-[#1E293B] border border-[#E2E8F0]"
    : variant === "blue"
    ? "bg-gradient-to-br from-[#1B5BDA] to-[#0F3280] text-white"
    : "bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white";

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-10">
      <div className={`p-10 md:p-14 rounded-[20px] text-center ${bgClass}`}>
        <h3 className="text-2xl md:text-[28px] font-bold mb-3">{title}</h3>
        {subtitle && <p className={`text-sm mb-6 ${variant === "light" ? "text-muted-foreground" : "text-white/70"}`}>{subtitle}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          {buttons.map((b) => (
            <Button
              key={b.label}
              onClick={() => b.to && navigate(b.to)}
              className={
                b.variant === "blue"
                  ? "bg-[#1B5BDA] hover:bg-[#1549b8] text-white px-6 h-11"
                  : b.variant === "white"
                  ? "bg-white text-[#1E293B] hover:bg-white/90 px-6 h-11"
                  : "border-2 border-current bg-transparent hover:bg-white/10 px-6 h-11"
              }
            >
              {b.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
