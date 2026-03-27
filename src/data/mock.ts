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
}

export const products: Product[] = [
  { id: 1, slug: "gants-nitrile-aurelia-x200", name: "Gants nitrile Aurelia x200", brand: "Aurelia", cnk: "12450", ean: "5412345678901", price: 12.90, pub: 28.50, pct: -55, sellers: 3, rating: 4.6, reviews: 127, best: "MedDistri", unit: "0,065/u", stock: true, mk: true, category: "EPI" },
  { id: 2, slug: "sekusept-aktiv-6kg", name: "Sekusept Aktiv 6kg", brand: "Ecolab", cnk: "10480", ean: "4027651000001", price: 33.59, pub: 72.00, pct: -53, sellers: 4, rating: 4.5, reviews: 89, best: "Pharmamed", unit: "5,60/L", stock: true, mk: true, category: "Desinfection" },
  { id: 3, slug: "masques-ffp2-kolmi-x50", name: "Masques FFP2 Kolmi x50", brand: "Kolmi", cnk: "15230", ean: "3401234567890", price: 18.50, pub: 35.00, pct: -47, sellers: 2, rating: 4.3, reviews: 56, best: "Brussels Med", unit: "0,37/u", stock: true, mk: true, category: "EPI" },
  { id: 4, slug: "compresses-steriles-10x10-x100", name: "Compresses steriles 10x10 x100", brand: "Hartmann", cnk: "11890", ean: "4049500100001", price: 4.20, pub: 9.50, pct: -56, sellers: 5, rating: 4.1, reviews: 42, best: "Pharma-GDD", unit: "0,042/u", stock: true, mk: false, category: "Pansements" },
  { id: 5, slug: "betadine-scrub-500ml", name: "Betadine Scrub 500ml", brand: "Meda Pharma", cnk: "13670", ean: "5412345000001", price: 8.75, pub: 17.90, pct: -51, sellers: 3, rating: 4.7, reviews: 203, best: "Pharmamed", unit: "17,50/L", stock: true, mk: true, category: "Desinfection" },
  { id: 6, slug: "tena-discreet-normal-x12", name: "TENA Discreet Normal x12", brand: "TENA", cnk: "4107876", ean: "0732254108612", price: 4.03, pub: 10.97, pct: -63, sellers: 2, rating: 4.4, reviews: 78, best: "Valerco", unit: "0,34/u", stock: true, mk: true, category: "Incontinence" },
  { id: 7, slug: "gel-hydroalcoolique-500ml", name: "Gel hydroalcoolique 500ml", brand: "Anios", cnk: "16780", ean: "3401234500001", price: 5.40, pub: 12.00, pct: -55, sellers: 3, rating: 4.2, reviews: 95, best: "MedDistri", unit: "10,80/L", stock: true, mk: true, category: "Desinfection" },
  { id: 8, slug: "blouse-chirurgicale-sterile", name: "Blouse chirurgicale sterile x25", brand: "Kolmi", cnk: "17890", ean: "3401234600002", price: 22.50, pub: 45.00, pct: -50, sellers: 2, rating: 4.0, reviews: 34, best: "Brussels Med", unit: "0,90/u", stock: true, mk: false, category: "EPI" },
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
  { name: "Hartmann", count: 289, slug: "hartmann", letter: "H" },
  { name: "Kolmi", count: 56, slug: "kolmi", letter: "K" },
  { name: "Meda Pharma", count: 123, slug: "meda-pharma", letter: "M" },
  { name: "Molnlycke", count: 178, slug: "molnlycke", letter: "M" },
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
