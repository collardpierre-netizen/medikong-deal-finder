import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CtaBannerProps {
  variant: "warm" | "dark";
  title: string;
  subtitle?: string;
  buttons: { label: string; variant: "pink" | "outline" | "white"; to?: string }[];
}

export function CtaBanner({ variant, title, subtitle, buttons }: CtaBannerProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-10">
      <div
        className={`p-10 md:p-14 rounded-[20px] text-center ${
          variant === "warm"
            ? "bg-gradient-to-br from-[#FFF7ED] via-[#FECDD3] to-[#F5F3FF] text-[#1E293B]"
            : "bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white"
        }`}
      >
        <h3 className="text-2xl md:text-[28px] font-bold mb-3">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          {buttons.map((b) => (
            <Button
              key={b.label}
              onClick={() => b.to && navigate(b.to)}
              className={
                b.variant === "pink"
                  ? "bg-[#E70866] hover:bg-[#C70758] text-white px-6 h-11"
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
