import { Shield, Droplets, Wind, Heart, Pill, Stethoscope, Syringe, Thermometer, Scissors, Package, FlaskConical, Bandage, Hand, Eye, Pipette, Beaker } from "lucide-react";

export interface Product {
  id: number;
  slug: string;
  name: string;
  brand: string;
  cnk: string;
  ean: string;
  price: number;
  pub: number;
  pct: number;
  sellers: number;
  rating: number;
  reviews: number;
  best: string;
  unit: string;
  stock: boolean;
  mk: boolean;
  category?: string;
  color?: string;
  iconName?: string;
}

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

export const products: Product[] = [
  { id: 1, slug: "gants-nitrile-aurelia-x200", name: "Gants nitrile Aurelia x200", brand: "Aurelia", cnk: "12450", ean: "5412345678901", price: 12.90, pub: 28.50, pct: -55, sellers: 3, rating: 4.6, reviews: 127, best: "MedDistri", unit: "0,065/u", stock: true, mk: true, category: "EPI", color: "blue", iconName: "Hand" },
  { id: 2, slug: "sekusept-aktiv-6kg", name: "Sekusept Aktiv 6kg", brand: "Ecolab", cnk: "10480", ean: "4027651000001", price: 33.59, pub: 72.00, pct: -53, sellers: 4, rating: 4.5, reviews: 89, best: "Pharmamed", unit: "5,60/L", stock: true, mk: true, category: "Desinfection", color: "teal", iconName: "FlaskConical" },
  { id: 3, slug: "masques-ffp2-kolmi-x50", name: "Masques FFP2 Kolmi x50", brand: "Kolmi", cnk: "15230", ean: "3401234567890", price: 18.50, pub: 35.00, pct: -47, sellers: 2, rating: 4.3, reviews: 56, best: "Brussels Med", unit: "0,37/u", stock: true, mk: true, category: "EPI", color: "green", iconName: "Wind" },
  { id: 4, slug: "compresses-steriles-10x10-x100", name: "Compresses steriles 10x10 x100", brand: "Hartmann", cnk: "11890", ean: "4049500100001", price: 4.20, pub: 9.50, pct: -56, sellers: 5, rating: 4.1, reviews: 42, best: "Pharma-GDD", unit: "0,042/u", stock: true, mk: false, category: "Pansements", color: "rose", iconName: "Bandage" },
  { id: 5, slug: "betadine-scrub-500ml", name: "Betadine Scrub 500ml", brand: "Meda Pharma", cnk: "13670", ean: "5412345000001", price: 8.75, pub: 17.90, pct: -51, sellers: 3, rating: 4.7, reviews: 203, best: "Pharmamed", unit: "17,50/L", stock: true, mk: true, category: "Desinfection", color: "amber", iconName: "Droplets" },
  { id: 6, slug: "tena-discreet-normal-x12", name: "TENA Discreet Normal x12", brand: "TENA", cnk: "4107876", ean: "0732254108612", price: 4.03, pub: 10.97, pct: -63, sellers: 2, rating: 4.4, reviews: 78, best: "Valerco", unit: "0,34/u", stock: true, mk: true, category: "Incontinence", color: "purple", iconName: "Droplets" },
  { id: 7, slug: "gel-hydroalcoolique-500ml", name: "Gel hydroalcoolique 500ml", brand: "Anios", cnk: "16780", ean: "3401234500001", price: 5.40, pub: 12.00, pct: -55, sellers: 3, rating: 4.2, reviews: 95, best: "MedDistri", unit: "10,80/L", stock: true, mk: true, category: "Desinfection", color: "cyan", iconName: "FlaskConical" },
  { id: 8, slug: "blouse-chirurgicale-sterile", name: "Blouse chirurgicale sterile x25", brand: "Kolmi", cnk: "17890", ean: "3401234600002", price: 22.50, pub: 45.00, pct: -50, sellers: 2, rating: 4.0, reviews: 34, best: "Brussels Med", unit: "0,90/u", stock: true, mk: false, category: "EPI", color: "indigo", iconName: "Shield" },
  { id: 9, slug: "seringues-10ml-luer-x100", name: "Seringues 10ml Luer Lock x100", brand: "BD Medical", cnk: "18450", ean: "5412345678902", price: 15.80, pub: 32.00, pct: -51, sellers: 4, rating: 4.5, reviews: 112, best: "MedDistri", unit: "0,16/u", stock: true, mk: true, category: "Consommables", color: "blue", iconName: "Syringe" },
  { id: 10, slug: "thermometre-infrarouge-pro", name: "Thermometre infrarouge Pro", brand: "B.Braun", cnk: "19230", ean: "4049500200002", price: 42.90, pub: 89.00, pct: -52, sellers: 3, rating: 4.8, reviews: 67, best: "Pharmamed", unit: "42,90/u", stock: true, mk: true, category: "Diagnostic", color: "orange", iconName: "Thermometer" },
  { id: 11, slug: "ciseaux-chirurgicaux-14cm", name: "Ciseaux chirurgicaux 14cm", brand: "B.Braun", cnk: "20100", ean: "4049500300003", price: 8.50, pub: 18.00, pct: -53, sellers: 2, rating: 4.3, reviews: 45, best: "Brussels Med", unit: "8,50/u", stock: true, mk: false, category: "Instruments", color: "lime", iconName: "Scissors" },
  { id: 12, slug: "pansement-adhesif-sterile-x50", name: "Pansement adhesif sterile x50", brand: "Hartmann", cnk: "21780", ean: "4049500400004", price: 6.30, pub: 14.50, pct: -57, sellers: 4, rating: 4.4, reviews: 89, best: "MedDistri", unit: "0,13/u", stock: true, mk: true, category: "Pansements", color: "rose", iconName: "Bandage" },
  { id: 13, slug: "solution-nacl-0-9-1000ml", name: "NaCl 0,9% solution 1000ml", brand: "B.Braun", cnk: "22340", ean: "4049500500005", price: 2.10, pub: 5.50, pct: -62, sellers: 5, rating: 4.6, reviews: 156, best: "Pharmamed", unit: "2,10/L", stock: true, mk: true, category: "Consommables", color: "cyan", iconName: "Pipette" },
  { id: 14, slug: "stethoscope-littmann-classic-iii", name: "Stethoscope Littmann Classic III", brand: "3M", cnk: "23890", ean: "5412345678903", price: 89.90, pub: 149.00, pct: -40, sellers: 2, rating: 4.9, reviews: 234, best: "MedDistri", unit: "89,90/u", stock: true, mk: true, category: "Diagnostic", color: "indigo", iconName: "Stethoscope" },
  { id: 15, slug: "desinfectant-surface-5l", name: "Desinfectant surfaces 5L", brand: "Anios", cnk: "24560", ean: "3401234700003", price: 19.90, pub: 38.00, pct: -48, sellers: 3, rating: 4.3, reviews: 78, best: "Brussels Med", unit: "3,98/L", stock: true, mk: true, category: "Desinfection", color: "teal", iconName: "FlaskConical" },
  { id: 16, slug: "protection-incontinence-nuit-x14", name: "Protection nuit x14", brand: "TENA", cnk: "25100", ean: "0732254108613", price: 9.80, pub: 19.99, pct: -51, sellers: 3, rating: 4.5, reviews: 67, best: "Valerco", unit: "0,70/u", stock: true, mk: true, category: "Incontinence", color: "purple", iconName: "Shield" },
  { id: 17, slug: "gants-latex-hartmann-x100", name: "Gants latex poudrés x100", brand: "Hartmann", cnk: "26780", ean: "4049500600006", price: 7.50, pub: 15.00, pct: -50, sellers: 4, rating: 4.2, reviews: 93, best: "MedDistri", unit: "0,075/u", stock: true, mk: true, category: "EPI", color: "amber", iconName: "Hand" },
  { id: 18, slug: "chariot-soins-inox-3-plateaux", name: "Chariot soins inox 3 plateaux", brand: "Haeberle", cnk: "27340", ean: "4049500700007", price: 289.00, pub: 450.00, pct: -36, sellers: 1, rating: 4.7, reviews: 23, best: "Pharmamed", unit: "289,00/u", stock: true, mk: false, category: "Mobilier", color: "lime", iconName: "Package" },
  { id: 19, slug: "oxymetre-pouls-digital", name: "Oxymetre de pouls digital", brand: "Nonin", cnk: "28900", ean: "5412345678904", price: 35.50, pub: 69.00, pct: -49, sellers: 3, rating: 4.6, reviews: 145, best: "MedDistri", unit: "35,50/u", stock: true, mk: true, category: "Diagnostic", color: "orange", iconName: "Heart" },
  { id: 20, slug: "bande-cohesive-elastique-x12", name: "Bande cohesive elastique x12", brand: "BSN", cnk: "29450", ean: "4049500800008", price: 11.20, pub: 24.00, pct: -53, sellers: 3, rating: 4.4, reviews: 56, best: "Brussels Med", unit: "0,93/u", stock: true, mk: true, category: "Pansements", color: "green", iconName: "Bandage" },
];

export const brands = [
  { name: "3M", count: 234, slug: "3m", letter: "A" },
  { name: "Aurelia", count: 89, slug: "aurelia", letter: "A" },
  { name: "Abena", count: 156, slug: "abena", letter: "A" },
  { name: "Anios", count: 67, slug: "anios", letter: "A" },
  { name: "B.Braun", count: 312, slug: "b-braun", letter: "B" },
  { name: "BD Medical", count: 198, slug: "bd-medical", letter: "B" },
  { name: "BSN", count: 145, slug: "bsn", letter: "B" },
  { name: "Coloplast", count: 78, slug: "coloplast", letter: "C" },
  { name: "Drager", count: 45, slug: "drager", letter: "D" },
  { name: "Ecolab", count: 167, slug: "ecolab", letter: "E" },
  { name: "Essity", count: 234, slug: "essity", letter: "E" },
  { name: "Haeberle", count: 34, slug: "haeberle", letter: "H" },
  { name: "Hartmann", count: 289, slug: "hartmann", letter: "H" },
  { name: "Kolmi", count: 56, slug: "kolmi", letter: "K" },
  { name: "Meda Pharma", count: 123, slug: "meda-pharma", letter: "M" },
  { name: "Molnlycke", count: 178, slug: "molnlycke", letter: "M" },
  { name: "Nonin", count: 42, slug: "nonin", letter: "N" },
  { name: "SCA", count: 67, slug: "sca", letter: "S" },
  { name: "TENA", count: 234, slug: "tena", letter: "T" },
];

export const categories = [
  { name: "EPI & Protection", count: "2 400+", icon: "Shield", slug: "epi" },
  { name: "Desinfection", count: "1 800+", icon: "Droplets", slug: "desinfection" },
  { name: "Instruments", count: "950+", icon: "Wrench", slug: "instruments" },
  { name: "Pansements & Soins", count: "1 200+", icon: "Heart", slug: "pansements" },
  { name: "Diagnostic", count: "680+", icon: "Activity", slug: "diagnostic" },
  { name: "Incontinence", count: "420+", icon: "Droplet", slug: "incontinence" },
  { name: "Mobilier medical", count: "310+", icon: "Armchair", slug: "mobilier" },
  { name: "Consommables", count: "3 100+", icon: "Package", slug: "consommables" },
];

export const sellers = [
  { name: "MedDistri", verified: true, topRated: true, location: "Bruxelles", rating: 4.8, orders: 12500 },
  { name: "Pharmamed", verified: true, topRated: true, location: "Liege", rating: 4.7, orders: 9800 },
  { name: "Brussels Med", verified: true, topRated: false, location: "Bruxelles", rating: 4.5, orders: 6200 },
  { name: "Valerco", verified: true, topRated: false, location: "Gand", rating: 4.3, orders: 4100 },
  { name: "Pharma-GDD", verified: true, topRated: false, location: "Anvers", rating: 4.2, orders: 3500 },
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
