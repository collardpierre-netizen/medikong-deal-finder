/**
 * Formatage monétaire dynamique (locale-aware).
 *
 * - Côté React, utiliser le hook `useMoneyFormat()` qui lit la langue UI active
 *   (i18next) et résout la locale Intl correspondante.
 * - Côté utilitaire (sans React), utiliser les fonctions pures `formatMoney`,
 *   `formatMoneyFromCents`, `formatDelta` avec une `locale` explicite. Si non
 *   fournie, fallback `fr-BE` pour préserver le comportement historique.
 *
 * Devise par défaut : EUR. Le helper accepte n'importe quel ISO 4217 si un jour
 * l'app supporte d'autres devises (RFQ multi-currency déjà en mémoire).
 */

import { useTranslation } from "react-i18next";
import { useMemo } from "react";

export type MoneyLocale = "fr-BE" | "fr-FR" | "fr-LU" | "nl-BE" | "nl-NL" | "en-GB" | "de-DE" | string;
export type CurrencyCode = "EUR" | string;

const NBSP = "\u00A0";

/** Mapping langue UI (i18next) → locale Intl. */
export function resolveMoneyLocale(uiLanguage: string | undefined | null): MoneyLocale {
  const lang = (uiLanguage || "fr").toLowerCase().split("-")[0];
  switch (lang) {
    case "fr": return "fr-BE";
    case "nl": return "nl-BE";
    case "en": return "en-GB";
    case "de": return "de-DE";
    default: return "fr-BE";
  }
}

export interface FormatMoneyOptions {
  locale?: MoneyLocale;
  currency?: CurrencyCode;
  /** Affiche le symbole de la devise. true par défaut. */
  withSymbol?: boolean;
  /** Nombre de décimales. 2 par défaut. */
  fractionDigits?: number;
}

/** Formate un montant en unité principale (ex: 12.34 → "12,34 €"). */
export function formatMoney(amount: number | null | undefined, opts: FormatMoneyOptions = {}): string {
  const v = Number(amount);
  if (!Number.isFinite(v)) return "—";
  const locale = opts.locale ?? "fr-BE";
  const currency = opts.currency ?? "EUR";
  const withSymbol = opts.withSymbol ?? true;
  const fractionDigits = opts.fractionDigits ?? 2;

  if (withSymbol) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(v);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(v);
}

/** Raccourci pour les valeurs stockées en cents (standard MediKong). */
export function formatMoneyFromCents(cents: number | null | undefined, opts: FormatMoneyOptions = {}): string {
  const c = Number(cents);
  if (!Number.isFinite(c)) return "—";
  return formatMoney(c / 100, opts);
}

/** Formate un delta avec signe explicite ("+12,34 €" / "−5,00 €"). */
export function formatDelta(amount: number | null | undefined, opts: FormatMoneyOptions = {}): string {
  const v = Number(amount);
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return formatMoney(0, opts);
  const sign = v > 0 ? "+" : "−";
  return `${sign}${NBSP}${formatMoney(Math.abs(v), opts)}`;
}

/** Formate un delta (en cents) avec signe explicite. */
export function formatDeltaFromCents(cents: number | null | undefined, opts: FormatMoneyOptions = {}): string {
  const c = Number(cents);
  if (!Number.isFinite(c)) return "—";
  return formatDelta(c / 100, opts);
}

export interface UseMoneyFormatResult {
  locale: MoneyLocale;
  currency: CurrencyCode;
  formatMoney: (amount: number | null | undefined, opts?: FormatMoneyOptions) => string;
  formatMoneyFromCents: (cents: number | null | undefined, opts?: FormatMoneyOptions) => string;
  formatDelta: (amount: number | null | undefined, opts?: FormatMoneyOptions) => string;
  formatDeltaFromCents: (cents: number | null | undefined, opts?: FormatMoneyOptions) => string;
}

/** Hook React : retourne des formatters liés à la langue UI active. */
export function useMoneyFormat(currency: CurrencyCode = "EUR"): UseMoneyFormatResult {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = resolveMoneyLocale(i18n.language);
    const baseOpts = { locale, currency };
    return {
      locale,
      currency,
      formatMoney: (amount, opts) => formatMoney(amount, { ...baseOpts, ...opts }),
      formatMoneyFromCents: (cents, opts) => formatMoneyFromCents(cents, { ...baseOpts, ...opts }),
      formatDelta: (amount, opts) => formatDelta(amount, { ...baseOpts, ...opts }),
      formatDeltaFromCents: (cents, opts) => formatDeltaFromCents(cents, { ...baseOpts, ...opts }),
    };
  }, [i18n.language, currency]);
}
