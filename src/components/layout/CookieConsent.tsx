import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Cookie, X, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";

const COOKIE_KEY = "mk_cookie_consent";

interface CookiePrefs {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

const defaultPrefs: CookiePrefs = {
  essential: true,
  analytics: false,
  marketing: false,
  functional: false,
};

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState<CookiePrefs>(defaultPrefs);

  useEffect(() => {
    const saved = localStorage.getItem(COOKIE_KEY);
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const save = (p: CookiePrefs) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(p));
    window.dispatchEvent(new Event("mk:cookie-consent-saved"));
    setVisible(false);
  };

  const acceptAll = () => save({ essential: true, analytics: true, marketing: true, functional: true });
  const rejectAll = () => save(defaultPrefs);
  const saveCustom = () => save(prefs);

  if (!visible) return null;

  const categories = [
    { key: "essential" as const, label: "Essentiels", desc: "Nécessaires au fonctionnement du site. Ne peuvent pas être désactivés.", locked: true },
    { key: "analytics" as const, label: "Analytiques", desc: "Nous aident à comprendre comment vous utilisez le site pour l'améliorer.", locked: false },
    { key: "marketing" as const, label: "Marketing", desc: "Utilisés pour vous proposer des publicités pertinentes.", locked: false },
    { key: "functional" as const, label: "Fonctionnels", desc: "Permettent des fonctionnalités avancées et la personnalisation.", locked: false },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center pointer-events-none p-4">
      <div className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-2xl border border-border pointer-events-auto animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start gap-3 p-5 pb-0">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <Cookie size={20} className="text-[#1B5BDA]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-[#1E293B]">Gestion des cookies</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Nous utilisons des cookies pour améliorer votre expérience.{" "}
              <Link to="/cookies" className="text-[#1B5BDA] hover:underline">En savoir plus</Link>
            </p>
          </div>
          <button onClick={rejectAll} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 pt-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1B5BDA] hover:underline"
          >
            Personnaliser mes choix
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showDetails && (
          <div className="px-5 pt-3 space-y-3">
            {categories.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-border/50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1E293B]">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
                </div>
                <Switch
                  checked={prefs[cat.key]}
                  onCheckedChange={(v) => !cat.locked && setPrefs({ ...prefs, [cat.key]: v })}
                  disabled={cat.locked}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 p-5">
          <Button
            onClick={rejectAll}
            variant="outline"
            className="flex-1 h-10 text-sm font-semibold"
          >
            Refuser tout
          </Button>
          {showDetails ? (
            <Button
              onClick={saveCustom}
              className="flex-1 h-10 text-sm font-semibold bg-[#1B5BDA] hover:bg-[#1549b8] text-white"
            >
              Enregistrer
            </Button>
          ) : (
            <Button
              onClick={acceptAll}
              className="flex-1 h-10 text-sm font-semibold bg-[#1B5BDA] hover:bg-[#1549b8] text-white"
            >
              Tout accepter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
