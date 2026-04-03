import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Languages } from "lucide-react";

const COOKIE_KEY = "mk_cookie_consent";
const TRANSLATION_POPUP_KEY = "medikong_translation_popup_seen";

export function TranslationActivatedPopup() {
  const { t, i18n } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const maybeShowPopup = () => {
      const hasCookieConsent = localStorage.getItem(COOKIE_KEY);
      const hasSeenPopup = localStorage.getItem(TRANSLATION_POPUP_KEY);

      if (!hasCookieConsent || i18n.language === "fr" || hasSeenPopup) {
        return;
      }

      setShow(true);
      localStorage.setItem(TRANSLATION_POPUP_KEY, "true");
    };

    maybeShowPopup();
    window.addEventListener("mk:cookie-consent-saved", maybeShowPopup);

    return () => {
      window.removeEventListener("mk:cookie-consent-saved", maybeShowPopup);
    };
  }, [i18n.language]);

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[360px] text-center py-10">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Languages size={28} className="text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-bold mb-2">{t("common.translationActivated")}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t("common.translationDescription")}</p>
        <button
          onClick={() => setShow(false)}
          className="text-sm font-medium text-foreground underline hover:no-underline"
        >
          {t("common.translationSettings")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
