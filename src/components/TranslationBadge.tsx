import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TranslationBadgeProps {
  originalText?: string;
  className?: string;
}

export function TranslationBadge({ originalText, className = "" }: TranslationBadgeProps) {
  const { t, i18n } = useTranslation();
  const [showOriginal, setShowOriginal] = useState(false);

  if (i18n.language === "fr") return null;

  const autoTranslate = typeof window !== "undefined"
    ? localStorage.getItem("medikong_auto_translate") !== "false"
    : true;
  if (!autoTranslate) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => originalText && setShowOriginal(!showOriginal)}
            className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors ${className}`}
          >
            <Languages size={12} />
            {showOriginal ? t("common.showOriginal") : t("common.autoTranslated")}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[250px]">{t("common.translationDescription")}</p>
          {originalText && showOriginal && (
            <p className="text-xs mt-1 italic opacity-70">{originalText}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
