import { useCallback, useEffect, useState } from "react";

/**
 * Historique récent type "Trivago" stocké en localStorage.
 * 3 buckets : termes tapés, produits visités, marques/catégories visitées.
 *
 * Pourquoi localStorage : fonctionne anonyme + connecté, instantané, zéro DB.
 * Pour cross-device, on pourra plus tard ajouter une sync DB (table
 * `user_search_history`) sans changer cette API.
 */

const KEYS = {
  terms: "mk_recent_terms",
  products: "mk_recent_products",
  taxons: "mk_recent_taxons", // brands + categories
} as const;

const MAX = { terms: 8, products: 6, taxons: 6 };

export type RecentTerm = { q: string; ts: number };
export type RecentProduct = {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
  ts: number;
};
export type RecentTaxon = {
  type: "brand" | "category";
  slug: string;
  name: string;
  ts: number;
};

function safeRead<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function safeWrite<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    // Notifier les autres onglets/composants qui écoutent.
    window.dispatchEvent(new CustomEvent("mk-recent-activity-changed", { detail: { key } }));
  } catch {
    /* quota / private mode — silencieux */
  }
}

/* ────────────── pushers (à appeler aux endroits d'usage) ────────────── */

export function pushRecentTerm(q: string) {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 2) return;
  const list = safeRead<RecentTerm>(KEYS.terms).filter(
    (t) => t.q.toLowerCase() !== trimmed.toLowerCase()
  );
  list.unshift({ q: trimmed, ts: Date.now() });
  safeWrite(KEYS.terms, list.slice(0, MAX.terms));
}

export function pushRecentProduct(p: Omit<RecentProduct, "ts">) {
  if (!p?.id || !p?.slug) return;
  const list = safeRead<RecentProduct>(KEYS.products).filter((x) => x.id !== p.id);
  list.unshift({ ...p, ts: Date.now() });
  safeWrite(KEYS.products, list.slice(0, MAX.products));
}

export function pushRecentTaxon(t: Omit<RecentTaxon, "ts">) {
  if (!t?.slug || !t?.type) return;
  const list = safeRead<RecentTaxon>(KEYS.taxons).filter(
    (x) => !(x.type === t.type && x.slug === t.slug)
  );
  list.unshift({ ...t, ts: Date.now() });
  safeWrite(KEYS.taxons, list.slice(0, MAX.taxons));
}

export function clearRecentActivity() {
  safeWrite(KEYS.terms, []);
  safeWrite(KEYS.products, []);
  safeWrite(KEYS.taxons, []);
}

/* ────────────── React hook (lecture réactive) ────────────── */

export function useRecentActivity() {
  const [terms, setTerms] = useState<RecentTerm[]>(() => safeRead(KEYS.terms));
  const [products, setProducts] = useState<RecentProduct[]>(() => safeRead(KEYS.products));
  const [taxons, setTaxons] = useState<RecentTaxon[]>(() => safeRead(KEYS.taxons));

  const refresh = useCallback(() => {
    setTerms(safeRead(KEYS.terms));
    setProducts(safeRead(KEYS.products));
    setTaxons(safeRead(KEYS.taxons));
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("mk-recent-activity-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mk-recent-activity-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return {
    terms,
    products,
    taxons,
    isEmpty: terms.length === 0 && products.length === 0 && taxons.length === 0,
    clear: () => {
      clearRecentActivity();
      refresh();
    },
  };
}
