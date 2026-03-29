import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import de from "./locales/de.json";

export const SUPPORTED_LANGUAGES = ["fr", "nl", "en", "de"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_CONFIG: Record<SupportedLanguage, { name: string; nativeName: string; region: string; flag: string }> = {
  fr: { name: "Français", nativeName: "Français", region: "Belgique", flag: "🇧🇪" },
  nl: { name: "Dutch", nativeName: "Nederlands", region: "België", flag: "🇧🇪" },
  en: { name: "English", nativeName: "English", region: "International", flag: "🇬🇧" },
  de: { name: "German", nativeName: "Deutsch", region: "Belgien", flag: "🇩🇪" },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      nl: { translation: nl },
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: "fr",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "medikong_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
