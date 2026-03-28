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
// Keeping this empty array as fallback for backwards compatibility
export const products: Product[] = [];
export const brands = [
  { name: "3M", count: 234, slug: "3m", letter: "A", manufacturer: "3M Company", manufacturerSlug: "3m-company" },
  { name: "Aurelia", count: 89, slug: "aurelia", letter: "A", manufacturer: "Supermax", manufacturerSlug: "supermax" },
  { name: "Abena", count: 156, slug: "abena", letter: "A", manufacturer: "Abena A/S", manufacturerSlug: "abena-as" },
  { name: "Anios", count: 67, slug: "anios", letter: "A", manufacturer: "Ecolab", manufacturerSlug: "ecolab" },
  { name: "B.Braun", count: 312, slug: "b-braun", letter: "B", manufacturer: "B. Braun Melsungen", manufacturerSlug: "b-braun-melsungen" },
  { name: "BD Medical", count: 198, slug: "bd-medical", letter: "B", manufacturer: "Becton Dickinson", manufacturerSlug: "becton-dickinson" },
  { name: "BSN", count: 145, slug: "bsn", letter: "B", manufacturer: "Essity", manufacturerSlug: "essity" },
  { name: "Coloplast", count: 78, slug: "coloplast", letter: "C", manufacturer: "Coloplast A/S", manufacturerSlug: "coloplast-as" },
  { name: "Drager", count: 45, slug: "drager", letter: "D", manufacturer: "Drägerwerk", manufacturerSlug: "dragerwerk" },
  { name: "Ecolab", count: 167, slug: "ecolab", letter: "E", manufacturer: "Ecolab", manufacturerSlug: "ecolab" },
  { name: "Essity", count: 234, slug: "essity", letter: "E", manufacturer: "Essity AB", manufacturerSlug: "essity" },
  { name: "Haeberle", count: 34, slug: "haeberle", letter: "H", manufacturer: "Haeberle GmbH", manufacturerSlug: "haeberle-gmbh" },
  { name: "Hartmann", count: 289, slug: "hartmann", letter: "H", manufacturer: "Paul Hartmann AG", manufacturerSlug: "hartmann" },
  { name: "Kolmi", count: 56, slug: "kolmi", letter: "K", manufacturer: "Kolmi-Hopen", manufacturerSlug: "kolmi-hopen" },
  { name: "Meda Pharma", count: 123, slug: "meda-pharma", letter: "M", manufacturer: "Mylan/Viatris", manufacturerSlug: "viatris" },
  { name: "Molnlycke", count: 178, slug: "molnlycke", letter: "M", manufacturer: "Mölnlycke Health Care", manufacturerSlug: "molnlycke" },
  { name: "Nonin", count: 42, slug: "nonin", letter: "N", manufacturer: "Nonin Medical", manufacturerSlug: "nonin-medical" },
  { name: "SCA", count: 67, slug: "sca", letter: "S", manufacturer: "Essity AB", manufacturerSlug: "essity" },
  { name: "TENA", count: 234, slug: "tena", letter: "T", manufacturer: "Essity AB", manufacturerSlug: "essity" },
];

// Sellers with their brand/manufacturer portfolio
export const sellerPortfolios: Record<string, { brands: string[]; manufacturers: string[] }> = {
  "Valerco": { brands: ["Hartmann", "Molnlycke", "3M", "Aurelia", "Kolmi"], manufacturers: ["Paul Hartmann AG", "Mölnlycke Health Care", "3M Company", "Supermax", "Kolmi-Hopen"] },
  "Pharmamed": { brands: ["TENA", "Essity", "BSN", "Abena", "Meda Pharma"], manufacturers: ["Essity AB", "Abena A/S", "Mylan/Viatris"] },
  "MedDistri": { brands: ["B.Braun", "BD Medical", "Coloplast", "Drager"], manufacturers: ["B. Braun Melsungen", "Becton Dickinson", "Coloplast A/S", "Drägerwerk"] },
  "Brussels Med": { brands: ["Ecolab", "Anios", "Haeberle"], manufacturers: ["Ecolab", "Haeberle GmbH"] },
  "Pharma-GDD": { brands: ["Nonin", "SCA", "3M"], manufacturers: ["Nonin Medical", "Essity AB", "3M Company"] },
};

export const categories = [
  { name: "EPI & Protection", count: "2 400+", icon: "Shield", slug: "epi" },
  { name: "Désinfection", count: "1 800+", icon: "Droplets", slug: "desinfection" },
  { name: "Instruments", count: "950+", icon: "Wrench", slug: "instruments" },
  { name: "Pansements & Soins", count: "1 200+", icon: "Heart", slug: "pansements" },
  { name: "Diagnostic", count: "680+", icon: "Activity", slug: "diagnostic" },
  { name: "Incontinence", count: "420+", icon: "Droplet", slug: "incontinence" },
  { name: "Mobilier medical", count: "310+", icon: "Armchair", slug: "mobilier" },
  { name: "Consommables", count: "3 100+", icon: "Package", slug: "consommables" },
];

export const sellers = [
  { name: "MedDistri", slug: "meddistri", verified: true, topRated: true, location: "Bruxelles", rating: 4.8, orders: 12500 },
  { name: "Pharmamed", slug: "pharmamed", verified: true, topRated: true, location: "Liege", rating: 4.7, orders: 9800 },
  { name: "Brussels Med", slug: "brussels-med", verified: true, topRated: false, location: "Bruxelles", rating: 4.5, orders: 6200 },
  { name: "Valerco", slug: "valerco", verified: true, topRated: false, location: "Gand", rating: 4.3, orders: 4100 },
  { name: "Pharma-GDD", slug: "pharma-gdd", verified: true, topRated: false, location: "Anvers", rating: 4.2, orders: 3500 },
];

export const competitors = [
  { name: "Medi-Market", price: 6.67, status: "En stock" as const, date: "25/03/2026" },
  { name: "Newpharma", price: 8.99, status: "Promo" as const, date: "25/03/2026" },
  { name: "Farmaline", price: 7.49, status: "En stock" as const, date: "25/03/2026" },
  { name: "DocMorris BE", price: 9.20, status: "Rupture" as const, date: "25/03/2026" },
  { name: "Pharmacie.be", price: 7.85, status: "En stock" as const, date: "25/03/2026" },
];

export const universes = ["EPI", "Desinfection", "Instruments", "Pansements", "Diagnostic", "Mobilier", "Nutrition", "Marques A-Z"];

export function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

// Icon map for product placeholders
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const productIconMap: Record<string, any> = {
  Hand, FlaskConical, Wind, Bandage, Droplets, Shield, Syringe, Thermometer,
  Scissors, Package, Pipette, Stethoscope, Heart, Eye, Pill, Beaker,
};
