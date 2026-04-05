import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search, Languages, Sparkles, Check, X, Edit2, Download, Plus, Trash2,
  BarChart3, Package, Layers, BookOpen, Settings, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";

// ─── TYPES ──────────────────────────────────────────────────────────────────────
type TStatus = "not_translated" | "auto_translated" | "validated";
interface DemoProduct {
  id: string; ean: string; brand: string; category: string;
  titleEn: string; titleFr: string;
  descEn: string; descFr: string;
  status: TStatus; confidence: number;
}
interface CatRow { id: string; nameEn: string; nameFr: string; status: TStatus }
interface UiRow { key: string; en: string; fr: string; status: TStatus }
interface GlossaryRow { id: string; termEn: string; termFr: string; context: string }

// ─── DEMO DATA ──────────────────────────────────────────────────────────────────
const BRANDS = ["Vichy", "Bioderma", "La Roche-Posay", "Eucerin", "Avène", "Ducray", "Klorane", "Nuxe", "Caudalie", "Dercos"];
const CATEGORIES = ["Skin Care", "Hair Care", "Baby Care", "Oral Care", "Nutrition", "First Aid", "Wound Care", "Hygiene"];

function makeDemoProducts(): DemoProduct[] {
  const items: Omit<DemoProduct, "id">[] = [
    { ean: "3337875598071", brand: "Vichy", category: "Skin Care", titleEn: "Vichy Mineral 89 Hyaluronic Acid Serum", titleFr: "Vichy Minéral 89 Sérum à l'acide hyaluronique", descEn: "Daily booster for stronger, plumper skin.", descFr: "Booster quotidien pour une peau plus forte et repulpée.", status: "validated", confidence: 98 },
    { ean: "3337875709361", brand: "Vichy", category: "Skin Care", titleEn: "Vichy LiftActiv Supreme Day Cream", titleFr: "Vichy LiftActiv Supreme Crème de jour", descEn: "Anti-wrinkle and firming care.", descFr: "Soin anti-rides et raffermissant.", status: "validated", confidence: 97 },
    { ean: "3401399276013", brand: "Bioderma", category: "Skin Care", titleEn: "Bioderma Sensibio H2O Micellar Water", titleFr: "Bioderma Sensibio H2O Eau micellaire", descEn: "Micellar water for sensitive skin.", descFr: "Eau micellaire pour peaux sensibles.", status: "validated", confidence: 99 },
    { ean: "3401345505217", brand: "Bioderma", category: "Skin Care", titleEn: "Bioderma Atoderm Intensive Baume", titleFr: "Bioderma Atoderm Intensive Baume", descEn: "Ultra-soothing balm for very dry skin.", descFr: "Baume ultra-apaisant pour peaux très sèches.", status: "auto_translated", confidence: 95 },
    { ean: "3337875545785", brand: "La Roche-Posay", category: "Skin Care", titleEn: "La Roche-Posay Effaclar Duo+ SPF30", titleFr: "La Roche-Posay Effaclar Duo+ SPF30", descEn: "Anti-imperfection corrective care.", descFr: "Soin correcteur anti-imperfections.", status: "auto_translated", confidence: 92 },
    { ean: "3337875684170", brand: "La Roche-Posay", category: "Skin Care", titleEn: "La Roche-Posay Cicaplast Baume B5+", titleFr: "", descEn: "Multi-purpose repairing balm.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "4005800233784", brand: "Eucerin", category: "Skin Care", titleEn: "Eucerin AQUAporin Active Moisturizer", titleFr: "Eucerin AQUAporin Active Hydratant", descEn: "Intense hydration for all skin types.", descFr: "Hydratation intense pour tous types de peaux.", status: "auto_translated", confidence: 91 },
    { ean: "4005800235863", brand: "Eucerin", category: "Skin Care", titleEn: "Eucerin Hyaluron-Filler Night Cream", titleFr: "", descEn: "Anti-aging night cream with hyaluronic acid.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3282770037340", brand: "Avène", category: "Skin Care", titleEn: "Avène Thermal Spring Water Spray", titleFr: "Avène Eau Thermale Spray", descEn: "Soothing and softening thermal water.", descFr: "Eau thermale apaisante et adoucissante.", status: "validated", confidence: 99 },
    { ean: "3282770149227", brand: "Avène", category: "Skin Care", titleEn: "Avène Cicalfate+ Restorative Cream", titleFr: "", descEn: "Restorative protective cream.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3282770140972", brand: "Ducray", category: "Hair Care", titleEn: "Ducray Anaphase+ Anti-Hair Loss Shampoo", titleFr: "Ducray Anaphase+ Shampooing anti-chute", descEn: "Complement to hair loss treatments.", descFr: "Complément aux traitements anti-chute.", status: "auto_translated", confidence: 93 },
    { ean: "3282770106008", brand: "Ducray", category: "Hair Care", titleEn: "Ducray Squanorm Anti-Dandruff Shampoo", titleFr: "Ducray Squanorm Shampooing anti-pelliculaire", descEn: "Treatment shampoo for oily dandruff.", descFr: "Shampooing traitant pour pellicules grasses.", status: "validated", confidence: 97 },
    { ean: "3282770145366", brand: "Klorane", category: "Hair Care", titleEn: "Klorane Shampoo with Oat Milk", titleFr: "Klorane Shampooing au lait d'avoine", descEn: "Ultra-gentle shampoo for frequent use.", descFr: "Shampooing extra-doux pour usage fréquent.", status: "validated", confidence: 98 },
    { ean: "3282770149586", brand: "Klorane", category: "Hair Care", titleEn: "Klorane Dry Shampoo with Nettle", titleFr: "", descEn: "Oil-absorbing dry shampoo.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3264680004070", brand: "Nuxe", category: "Skin Care", titleEn: "Nuxe Huile Prodigieuse Multi-Purpose Dry Oil", titleFr: "Nuxe Huile Prodigieuse Huile sèche multi-usage", descEn: "Multi-purpose dry oil for face, body and hair.", descFr: "Huile sèche multi-usage visage, corps et cheveux.", status: "auto_translated", confidence: 94 },
    { ean: "3264680003998", brand: "Nuxe", category: "Skin Care", titleEn: "Nuxe Rêve de Miel Lip Balm", titleFr: "", descEn: "Ultra-nourishing lip balm.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3522930003205", brand: "Caudalie", category: "Skin Care", titleEn: "Caudalie Vinoperfect Radiance Serum", titleFr: "Caudalie Vinoperfect Sérum Éclat", descEn: "Anti-dark spot serum for radiant skin.", descFr: "Sérum anti-taches pour une peau éclatante.", status: "auto_translated", confidence: 90 },
    { ean: "3522930003106", brand: "Caudalie", category: "Skin Care", titleEn: "Caudalie Beauty Elixir", titleFr: "", descEn: "Smoothing and glow-boosting mist.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3337871330125", brand: "Dercos", category: "Hair Care", titleEn: "Dercos Anti-Dandruff Shampoo Normal Hair", titleFr: "Dercos Shampooing Anti-pelliculaire Cheveux normaux", descEn: "Targets dandruff while respecting the scalp.", descFr: "Cible les pellicules tout en respectant le cuir chevelu.", status: "validated", confidence: 96 },
    { ean: "3337871330231", brand: "Dercos", category: "Hair Care", titleEn: "Dercos Energising Shampoo", titleFr: "Dercos Shampooing Énergisant", descEn: "Stimulating shampoo complement to hair loss treatments.", descFr: "Shampooing stimulant complément des traitements anti-chute.", status: "auto_translated", confidence: 89 },
    { ean: "3337875588775", brand: "Vichy", category: "Hair Care", titleEn: "Vichy Dercos Nutrients Vitamin ACE Shine Shampoo", titleFr: "", descEn: "Shine-boosting shampoo enriched with vitamins.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3401398202811", brand: "Bioderma", category: "Baby Care", titleEn: "Bioderma ABCDerm Cold-Cream Body Cream", titleFr: "Bioderma ABCDerm Cold-Cream Crème Corps", descEn: "Nourishing body cream for babies.", descFr: "Crème nourrissante corps pour bébés.", status: "validated", confidence: 97 },
    { ean: "3282770073089", brand: "Avène", category: "Baby Care", titleEn: "Avène Pediatril Cleansing Gel", titleFr: "", descEn: "Gentle cleansing gel for baby skin.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3264680014888", brand: "Nuxe", category: "Nutrition", titleEn: "Nuxe BioBeauté Vitamin-Rich Detox Mask", titleFr: "Nuxe BioBeauté Masque Détox Vitaminé", descEn: "Detoxifying mask enriched with vitamins.", descFr: "Masque détoxifiant enrichi en vitamines.", status: "auto_translated", confidence: 88 },
    { ean: "4005800127151", brand: "Eucerin", category: "First Aid", titleEn: "Eucerin Aquaphor Repairing Ointment", titleFr: "", descEn: "Multi-purpose healing ointment.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3337875546058", brand: "La Roche-Posay", category: "Wound Care", titleEn: "La Roche-Posay Cicaplast Gel B5", titleFr: "La Roche-Posay Cicaplast Gel B5", descEn: "Skin-repairing accelerating gel.", descFr: "Gel accélérateur de réparation cutanée.", status: "auto_translated", confidence: 93 },
    { ean: "3282770100556", brand: "Ducray", category: "Hygiene", titleEn: "Ducray Extra-Doux Shampoo", titleFr: "Ducray Shampooing Extra-Doux", descEn: "Gentle shampoo for delicate hair.", descFr: "Shampooing doux pour cheveux délicats.", status: "validated", confidence: 98 },
    { ean: "3522930003311", brand: "Caudalie", category: "Oral Care", titleEn: "Caudalie Lip Conditioner", titleFr: "", descEn: "Moisturizing and protective lip care.", descFr: "", status: "not_translated", confidence: 0 },
    { ean: "3282770200898", brand: "Klorane", category: "Hair Care", titleEn: "Klorane Conditioner with Mango Butter", titleFr: "Klorane Après-shampooing au beurre de mangue", descEn: "Nourishing detangling conditioner.", descFr: "Après-shampooing nourrissant démêlant.", status: "auto_translated", confidence: 91 },
    { ean: "3337875695077", brand: "La Roche-Posay", category: "Skin Care", titleEn: "La Roche-Posay Toleriane Sensitive Fluid", titleFr: "La Roche-Posay Toleriane Sensitive Fluide", descEn: "Daily soothing moisturiser for sensitive skin.", descFr: "Hydratant quotidien apaisant pour peaux sensibles.", status: "validated", confidence: 99 },
  ];
  return items.map((p, i) => ({ ...p, id: `prod-${i}` }));
}

const DEMO_CATS: CatRow[] = [
  { id: "c1", nameEn: "Anti Dandruff", nameFr: "Anti-pelliculaire", status: "validated" },
  { id: "c2", nameEn: "Hair Cleaning", nameFr: "Soin capillaire", status: "validated" },
  { id: "c3", nameEn: "Skin Care", nameFr: "Soins de la peau", status: "validated" },
  { id: "c4", nameEn: "Baby Care", nameFr: "Soins bébé", status: "validated" },
  { id: "c5", nameEn: "Wound Care", nameFr: "Soins des plaies", status: "auto_translated" },
  { id: "c6", nameEn: "Oral Care", nameFr: "Soins bucco-dentaires", status: "auto_translated" },
  { id: "c7", nameEn: "Hair Loss Treatment", nameFr: "", status: "not_translated" },
  { id: "c8", nameEn: "Sun Protection", nameFr: "", status: "not_translated" },
  { id: "c9", nameEn: "Eye Care", nameFr: "Soins oculaires", status: "validated" },
  { id: "c10", nameEn: "Nutrition", nameFr: "Nutrition", status: "validated" },
  { id: "c11", nameEn: "First Aid", nameFr: "Premiers secours", status: "auto_translated" },
  { id: "c12", nameEn: "Hygiene", nameFr: "Hygiène", status: "validated" },
];

const DEMO_UI: UiRow[] = [
  { key: "nav.shop", en: "Shop", fr: "Boutique", status: "validated" },
  { key: "nav.sourcing", en: "Sourcing", fr: "Approvisionnement", status: "validated" },
  { key: "nav.categories", en: "Categories", fr: "Catégories", status: "validated" },
  { key: "action.addToFav", en: "Add to favorites", fr: "Ajouter aux favoris", status: "validated" },
  { key: "action.seeAll", en: "See all products", fr: "Voir tous les produits", status: "validated" },
  { key: "shipping.free", en: "Free shipping", fr: "Livraison gratuite", status: "validated" },
  { key: "action.addToCart", en: "Add to cart", fr: "Ajouter au panier", status: "validated" },
  { key: "action.checkout", en: "Checkout", fr: "Passer commande", status: "auto_translated" },
  { key: "label.inStock", en: "In stock", fr: "En stock", status: "auto_translated" },
  { key: "label.outOfStock", en: "Out of stock", fr: "", status: "not_translated" },
  { key: "action.search", en: "Search products", fr: "Rechercher des produits", status: "validated" },
  { key: "label.unitPrice", en: "Unit price", fr: "Prix unitaire", status: "validated" },
];

const INITIAL_GLOSSARY: GlossaryRow[] = [
  { id: "g1", termEn: "Shampoo", termFr: "Shampooing", context: "Titres produits" },
  { id: "g2", termEn: "Anti-Dandruff", termFr: "Anti-pelliculaire", context: "Titres & catégories" },
  { id: "g3", termEn: "For Normal And Oily Hair", termFr: "Pour cheveux normaux à gras", context: "Descriptions" },
  { id: "g4", termEn: "Dermatological", termFr: "Dermatologique", context: "Descriptions" },
  { id: "g5", termEn: "Conditioner", termFr: "Après-shampooing", context: "Titres produits" },
  { id: "g6", termEn: "Moisturizing", termFr: "Hydratant", context: "Descriptions" },
  { id: "g7", termEn: "Soothing", termFr: "Apaisant", context: "Descriptions" },
  { id: "g8", termEn: "Cleansing", termFr: "Nettoyant", context: "Titres produits" },
  { id: "g9", termEn: "SPF", termFr: "SPF", context: "Universel" },
  { id: "g10", termEn: "Serum", termFr: "Sérum", context: "Titres produits" },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function statusBadge(s: TStatus) {
  if (s === "validated") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[11px]">Validé</Badge>;
  if (s === "auto_translated") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[11px]">Auto-traduit</Badge>;
  return <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-0 text-[11px]">Non traduit</Badge>;
}

function pct(n: number, t: number) { return t === 0 ? 0 : Math.round((n / t) * 100); }

// ─── CIRCULAR PROGRESS ─────────────────────────────────────────────────────────
function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36, circ = 2 * Math.PI * r, offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={88} height={88} className="-rotate-90">
        <circle cx={44} cy={44} r={r} fill="none" stroke="#E2E8F0" strokeWidth={7} />
        <circle cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <span className="text-xl font-bold -mt-14 mb-6" style={{ color }}>{value}%</span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────────
export default function AdminTranslations() {
  const [products, setProducts] = useState<DemoProduct[]>(makeDemoProducts);
  const [categories, setCategories] = useState(DEMO_CATS);
  const [uiRows, setUiRows] = useState(DEMO_UI);
  const [glossary, setGlossary] = useState(INITIAL_GLOSSARY);

  // Product tab state
  const [pSearch, setPSearch] = useState("");
  const [pStatus, setPStatus] = useState<string>("all");
  const [pBrand, setPBrand] = useState<string>("all");
  const [pPage, setPPage] = useState(1);
  const [editProduct, setEditProduct] = useState<DemoProduct | null>(null);
  const [editFr, setEditFr] = useState({ title: "", desc: "" });
  const [autoLoading, setAutoLoading] = useState(false);

  // Glossary add
  const [newGloss, setNewGloss] = useState({ en: "", fr: "", ctx: "" });

  // Settings state
  const [settAutoNew, setSettAutoNew] = useState(true);
  const [settGlossary, setSettGlossary] = useState(true);
  const [settEngine, setSettEngine] = useState("deepl");
  const [settLangs, setSettLangs] = useState({ fr: true, nl: false, de: false });

  // ─── PRODUCT FILTERING & PAGINATION ─────────────────────────────────────────
  const PAGE = 20;
  const filtered = useMemo(() => {
    let f = products;
    if (pStatus !== "all") f = f.filter(p => p.status === pStatus);
    if (pBrand !== "all") f = f.filter(p => p.brand === pBrand);
    if (pSearch) {
      const q = pSearch.toLowerCase();
      f = f.filter(p => p.titleEn.toLowerCase().includes(q) || p.ean.includes(q));
    }
    return f;
  }, [products, pStatus, pBrand, pSearch]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paged = filtered.slice((pPage - 1) * PAGE, pPage * PAGE);

  // ─── AUTO TRANSLATE SIMULATION ──────────────────────────────────────────────
  const runAutoTranslate = useCallback(() => {
    setAutoLoading(true);
    setTimeout(() => {
      setProducts(prev => prev.map(p => {
        if (p.status !== "not_translated") return p;
        return {
          ...p,
          titleFr: p.titleEn.replace("Shampoo", "Shampooing").replace("Cream", "Crème").replace("Serum", "Sérum").replace("Spray", "Spray").replace("Gel", "Gel").replace("Balm", "Baume").replace("Ointment", "Pommade").replace("Conditioner", "Après-shampooing"),
          descFr: p.descEn.replace("for", "pour").replace("skin", "peau").replace("hair", "cheveux").replace("gentle", "doux").replace("nourishing", "nourrissant"),
          status: "auto_translated" as TStatus,
          confidence: 75 + Math.floor(Math.random() * 20),
        };
      }));
      setCategories(prev => prev.map(c => {
        if (c.status !== "not_translated") return c;
        return { ...c, nameFr: c.nameEn + " (FR)", status: "auto_translated" as TStatus };
      }));
      setUiRows(prev => prev.map(u => {
        if (u.status !== "not_translated") return u;
        return { ...u, fr: u.en + " (FR)", status: "auto_translated" as TStatus };
      }));
      setAutoLoading(false);
      toast.success("Traduction automatique terminée", { description: "Tous les éléments ont été traduits." });
    }, 2500);
  }, []);

  // ─── STATS ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pTotal = products.length;
    const pTranslated = products.filter(p => p.status !== "not_translated").length;
    const cTotal = categories.length;
    const cTranslated = categories.filter(c => c.status !== "not_translated").length;
    const uTotal = uiRows.length;
    const uTranslated = uiRows.filter(u => u.status !== "not_translated").length;
    const globalTotal = pTotal + cTotal + uTotal;
    const globalDone = pTranslated + cTranslated + uTranslated;
    return { pTotal, pTranslated, cTotal, cTranslated, uTotal, uTranslated, globalTotal, globalDone };
  }, [products, categories, uiRows]);

  // ─── RECENT TRANSLATIONS ───────────────────────────────────────────────────
  const recentItems = useMemo(() => {
    const now = Date.now();
    return products
      .filter(p => p.status !== "not_translated")
      .slice(0, 10)
      .map((p, i) => ({ name: p.titleEn, status: p.status, time: new Date(now - i * 180_000).toLocaleString("fr-FR") }));
  }, [products]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Languages size={24} className="text-[#2563EB]" /> Traduction & Localisation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez les traductions de votre catalogue et interface</p>
        </div>
        <Button onClick={runAutoTranslate} disabled={autoLoading} className="bg-[#2563EB] hover:bg-[#1d4ed8] gap-2">
          <Sparkles size={16} />
          {autoLoading ? "Traduction en cours..." : "Lancer traduction auto"}
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 size={14} /> Dashboard</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package size={14} /> Produits</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Layers size={14} /> Catégories & UI</TabsTrigger>
          <TabsTrigger value="glossary" className="gap-1.5"><BookOpen size={14} /> Glossaire</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings size={14} /> Paramètres</TabsTrigger>
        </TabsList>

        {/* ═══ DASHBOARD TAB ═══ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CircularProgress value={pct(stats.pTranslated, stats.pTotal)} label="Produits traduits" color="#2563EB" />
            <CircularProgress value={pct(stats.cTranslated, stats.cTotal)} label="Catégories traduites" color="#16A34A" />
            <CircularProgress value={pct(stats.uTranslated, stats.uTotal)} label="Éléments UI traduits" color="#F59E0B" />
            <CircularProgress value={pct(stats.globalDone, stats.globalTotal)} label="Couverture globale" color="#7C3AED" />
          </div>

          {/* Bar chart */}
          <div className="bg-white border rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4">Progression par section</h3>
            <div className="space-y-3">
              {[
                { label: "Produits", done: stats.pTranslated, total: stats.pTotal, color: "#2563EB" },
                { label: "Catégories", done: stats.cTranslated, total: stats.cTotal, color: "#16A34A" },
                { label: "UI / Navigation", done: stats.uTranslated, total: stats.uTotal, color: "#F59E0B" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-right text-muted-foreground">{s.label}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct(s.done, s.total)}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="text-xs font-medium w-16">{s.done}/{s.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent */}
          <div className="bg-white border rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-3">10 dernières traductions</h3>
            <div className="space-y-2">
              {recentItems.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                  <span className="truncate max-w-[50%]">{r.name}</span>
                  <div className="flex items-center gap-3">
                    {statusBadge(r.status)}
                    <span className="text-muted-foreground">{r.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ═══ PRODUCTS TAB ═══ */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou EAN..." value={pSearch} onChange={e => { setPSearch(e.target.value); setPPage(1); }} className="pl-9" />
            </div>
            <Select value={pStatus} onValueChange={v => { setPStatus(v); setPPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="not_translated">Non traduit</SelectItem>
                <SelectItem value="auto_translated">Auto-traduit</SelectItem>
                <SelectItem value="validated">Validé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pBrand} onValueChange={v => { setPBrand(v); setPPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes marques</SelectItem>
                {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">EAN</TableHead>
                  <TableHead>Titre EN</TableHead>
                  <TableHead>Titre FR</TableHead>
                  <TableHead className="w-[110px]">Statut</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.ean}</TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate">{p.titleEn}</TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate">{p.titleFr || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditProduct(p); setEditFr({ title: p.titleFr, desc: p.descFr }); }}>
                          <Edit2 size={14} />
                        </Button>
                        {p.status === "auto_translated" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => {
                            setProducts(prev => prev.map(x => x.id === p.id ? { ...x, status: "validated" } : x));
                            toast.success("Traduction validée");
                          }}>
                            <Check size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} produit(s)</span>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={pPage <= 1} onClick={() => setPPage(p => p - 1)}><ChevronLeft size={14} /></Button>
              <span>Page {pPage}/{totalPages}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" disabled={pPage >= totalPages} onClick={() => setPPage(p => p + 1)}><ChevronRight size={14} /></Button>
            </div>
          </div>
        </TabsContent>

        {/* ═══ CATEGORIES & UI TAB ═══ */}
        <TabsContent value="categories" className="space-y-4">
          <Tabs defaultValue="cats">
            <TabsList><TabsTrigger value="cats">Catégories</TabsTrigger><TabsTrigger value="ui">Navigation & UI</TabsTrigger></TabsList>

            <TabsContent value="cats" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const data = Object.fromEntries(categories.filter(c => c.nameFr).map(c => [c.nameEn, c.nameFr]));
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "categories-fr.json"; a.click();
                  toast.success("JSON exporté");
                }}>
                  <Download size={14} /> Export JSON
                </Button>
              </div>
              <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead>EN</TableHead><TableHead>FR</TableHead><TableHead className="w-[100px]">Statut</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {categories.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{c.nameEn}</TableCell>
                        <TableCell>
                          <Input className="h-7 text-xs" value={c.nameFr} onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, nameFr: e.target.value, status: "validated" } : x))} placeholder="Traduction FR..." />
                        </TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="ui" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const data = Object.fromEntries(uiRows.filter(u => u.fr).map(u => [u.key, u.fr]));
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ui-fr.json"; a.click();
                  toast.success("JSON exporté");
                }}>
                  <Download size={14} /> Export JSON
                </Button>
              </div>
              <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[160px]">Clé</TableHead><TableHead>EN</TableHead><TableHead>FR</TableHead><TableHead className="w-[100px]">Statut</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {uiRows.map(u => (
                      <TableRow key={u.key}>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{u.key}</TableCell>
                        <TableCell className="text-xs">{u.en}</TableCell>
                        <TableCell>
                          <Input className="h-7 text-xs" value={u.fr} onChange={e => setUiRows(prev => prev.map(x => x.key === u.key ? { ...x, fr: e.target.value, status: "validated" } : x))} placeholder="Traduction FR..." />
                        </TableCell>
                        <TableCell>{statusBadge(u.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══ GLOSSARY TAB ═══ */}
        <TabsContent value="glossary" className="space-y-4">
          <div className="bg-white border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold">Ajouter une règle de traduction</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Terme EN</label>
                <Input value={newGloss.en} onChange={e => setNewGloss(p => ({ ...p, en: e.target.value }))} placeholder="Ex: Moisturizer" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Traduction FR</label>
                <Input value={newGloss.fr} onChange={e => setNewGloss(p => ({ ...p, fr: e.target.value }))} placeholder="Ex: Hydratant" />
              </div>
              <div className="w-[180px]">
                <label className="text-xs text-muted-foreground">Contexte</label>
                <Input value={newGloss.ctx} onChange={e => setNewGloss(p => ({ ...p, ctx: e.target.value }))} placeholder="Ex: Descriptions" />
              </div>
              <Button className="bg-[#2563EB] hover:bg-[#1d4ed8] gap-1.5" disabled={!newGloss.en || !newGloss.fr} onClick={() => {
                setGlossary(prev => [...prev, { id: `g${Date.now()}`, termEn: newGloss.en, termFr: newGloss.fr, context: newGloss.ctx || "Général" }]);
                setNewGloss({ en: "", fr: "", ctx: "" });
                toast.success("Règle ajoutée");
              }}>
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Terme EN</TableHead><TableHead>Traduction FR</TableHead><TableHead>Contexte</TableHead><TableHead className="w-[60px]" /></TableRow></TableHeader>
              <TableBody>
                {glossary.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="text-xs font-medium">{g.termEn}</TableCell>
                    <TableCell className="text-xs">{g.termFr}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{g.context}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => {
                        setGlossary(prev => prev.filter(x => x.id !== g.id));
                        toast.success("Règle supprimée");
                      }}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ SETTINGS TAB ═══ */}
        <TabsContent value="settings" className="space-y-4">
          <div className="bg-white border rounded-lg p-6 space-y-6 max-w-2xl">
            <div>
              <label className="text-sm font-medium">Langue source</label>
              <Select defaultValue="en"><SelectTrigger className="w-[200px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">🇬🇧 English</SelectItem></SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Langues cibles</label>
              <div className="flex gap-4 mt-2">
                {[
                  { code: "fr", flag: "🇫🇷", name: "Français" },
                  { code: "nl", flag: "🇳🇱", name: "Néerlandais" },
                  { code: "de", flag: "🇩🇪", name: "Allemand" },
                ].map(l => (
                  <label key={l.code} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded" checked={(settLangs as any)[l.code]} onChange={e => setSettLangs(p => ({ ...p, [l.code]: e.target.checked }))} />
                    {l.flag} {l.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Moteur de traduction</label>
              <Select value={settEngine} onValueChange={setSettEngine}>
                <SelectTrigger className="w-[250px] mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepl">DeepL API</SelectItem>
                  <SelectItem value="google">Google Translate</SelectItem>
                  <SelectItem value="custom">Custom / Lovable AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">Traduire automatiquement les nouveaux produits importés</label>
                <Switch checked={settAutoNew} onCheckedChange={setSettAutoNew} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">Utiliser le glossaire en priorité</label>
                <Switch checked={settGlossary} onCheckedChange={setSettGlossary} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Clé API</label>
              <Input type="password" value="sk-deepl-xxxxxxxxxxxx" readOnly className="w-[300px] mt-1" />
            </div>

            <Button className="bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={() => toast.success("Paramètres sauvegardés")}>Sauvegarder</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ EDIT PRODUCT MODAL ═══ */}
      <Dialog open={!!editProduct} onOpenChange={o => { if (!o) setEditProduct(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={16} /> Éditer la traduction
              {editProduct?.status === "auto_translated" && (
                <Badge variant="outline" className="ml-2 text-xs">Confiance: {editProduct.confidence}%</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Titre EN</label>
                <Input value={editProduct.titleEn} readOnly className="bg-slate-50" />
              </div>
              <div>
                <label className="text-xs font-medium">Titre FR</label>
                <Input value={editFr.title} onChange={e => setEditFr(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description EN</label>
                <Textarea value={editProduct.descEn} readOnly className="bg-slate-50 h-20" />
              </div>
              <div>
                <label className="text-xs font-medium">Description FR</label>
                <Textarea value={editFr.desc} onChange={e => setEditFr(p => ({ ...p, desc: e.target.value }))} className="h-20" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>Annuler</Button>
            <Button className="bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={() => {
              if (!editProduct) return;
              setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, titleFr: editFr.title, descFr: editFr.desc, status: "validated", confidence: 100 } : p));
              setEditProduct(null);
              toast.success("Traduction sauvegardée");
            }}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
