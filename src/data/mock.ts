import { Shield, Droplets, Wind, Heart, Pill, Stethoscope, Syringe, Thermometer, Scissors, Package, FlaskConical, Bandage, Hand, Eye, Pipette, Beaker } from "lucide-react";
import type { Product } from "@/hooks/useProducts";

export type { Product } from "@/hooks/useProducts";

// Color palette for product placeholders
export const productColors: Record<string, { bg: string; fg: string }> = {
  blue:    { bg: "#DBEAFE", fg: "#2563EB" },
  teal:    { bg: "#CCFBF1", fg: "#0D9488" },
  green:   { bg: "#DCFCE7", fg: "#16A34A" },
  amber:   { bg: "#FEF3C7", fg: "#D97706" },
  rose:    { bg: "#FFE4E6", fg: "#E11D48" },
  purple:  { bg: "#EDE9FE", fg: "#7C3AED" },
  orange:  { bg: "#FFEDD5", fg: "#EA580C" },
  cyan:    { bg: "#CFFAFE", fg: "#0891B2" },
  indigo:  { bg: "#E0E7FF", fg: "#4F46E5" },
  lime:    { bg: "#ECFCCB", fg: "#65A30D" },
};

// Products are now fetched from the database via useProducts hook
export const products: Product[] = [];

// Brands, sellers, categories — all fetched from Supabase now
// Keeping empty arrays for backward compatibility
export const brands: { name: string; count: number; slug: string; letter: string; manufacturer: string; manufacturerSlug: string }[] = [];
export const sellers: { name: string; slug: string; verified: boolean; topRated: boolean; location: string; rating: number; orders: number }[] = [];
export const sellerPortfolios: Record<string, { brands: string[]; manufacturers: string[] }> = {};
export const categories: { name: string; count: string; icon: string; slug: string }[] = [];
export const competitors: { name: string; price: number; status: string; date: string }[] = [];
export const universes: string[] = [];

export function formatPrice(price: number): string {
  return price.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Icon map for product placeholders
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const productIconMap: Record<string, any> = {
  Hand, FlaskConical, Wind, Bandage, Droplets, Shield, Syringe, Thermometer,
  Scissors, Package, Pipette, Stethoscope, Heart, Eye, Pill, Beaker,
};
