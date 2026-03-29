import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LANGUAGE_CONFIG, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";

export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(() => {
    try {
      return localStorage.getItem("medikong_auto_translate") !== "false";
    } catch {
      return true;
    }
  });

  const currentLang = (i18n.language?.substring(0, 2) || "fr") as SupportedLanguage;

  function changeLanguage(lang: SupportedLanguage) {
    i18n.changeLanguage(lang);
    localStorage.setItem("medikong_language", lang);
    document.documentElement.lang = lang;
    setOpen(false);
  }

  function toggleAutoTranslate(value: boolean) {
    setAutoTranslate(value);
    localStorage.setItem("medikong_auto_translate", String(value));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-white/15 transition-colors" style={{ background: "rgba(255,255,255,0.10)" }}>
          <Globe size={14} />
          <span className="uppercase">{currentLang}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-bold">{t("languageSelector.title")}</DialogTitle>
        </DialogHeader>

        {/* Auto-translate toggle */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg">🌐</div>
              <div>
                <p className="text-sm font-semibold">{t("languageSelector.translation")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("languageSelector.autoTranslateDesc", {
                    language: LANGUAGE_CONFIG[currentLang].nativeName,
                  })}
                </p>
              </div>
            </div>
            <Switch checked={autoTranslate} onCheckedChange={toggleAutoTranslate} />
          </div>
        </div>

        {/* Language grid */}
        <div className="px-6 pb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("languageSelector.suggested")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const config = LANGUAGE_CONFIG[lang];
              const isActive = lang === currentLang;
              return (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    isActive
                      ? "border-foreground bg-muted"
                      : "border-transparent hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-semibold">{config.nativeName}</p>
                  <p className="text-xs text-muted-foreground">{config.region}</p>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
