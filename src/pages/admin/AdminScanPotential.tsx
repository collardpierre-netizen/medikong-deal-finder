import { useMemo, useState } from "react";
import { Download, FlaskConical, SlidersHorizontal, TrendingUp, Users } from "lucide-react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DemoProduct = {
  product: string;
  brand: string;
  lab: string;
  pharmacies: number;
  withoutVolume: number;
  exactAnnual: number;
  estimatedAnnual: number;
  weightedPrice: number;
  medikongPrice: number;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  { product: "CeraVe Crème Hydratante 454 g", brand: "CeraVe", lab: "L'Oréal Dermatological Beauty", pharmacies: 18, withoutVolume: 3, exactAnnual: 1_740, estimatedAnnual: 1_224, weightedPrice: 14.5, medikongPrice: 12.7 },
  { product: "La Roche-Posay Anthelios UVMune 400", brand: "La Roche-Posay", lab: "L'Oréal Dermatological Beauty", pharmacies: 14, withoutVolume: 2, exactAnnual: 1_128, estimatedAnnual: 924, weightedPrice: 18.9, medikongPrice: 17.15 },
  { product: "Dafalgan 1 g 30 comprimés", brand: "Dafalgan", lab: "UPSA", pharmacies: 27, withoutVolume: 5, exactAnnual: 3_240, estimatedAnnual: 1_680, weightedPrice: 6.42, medikongPrice: 5.88 },
  { product: "Mustela Gel Lavant Doux 500 ml", brand: "Mustela", lab: "Laboratoires Expanscience", pharmacies: 11, withoutVolume: 1, exactAnnual: 768, estimatedAnnual: 600, weightedPrice: 9.75, medikongPrice: 9.2 },
  { product: "Bepanthen Pommade 100 g", brand: "Bepanthen", lab: "Bayer", pharmacies: 16, withoutVolume: 4, exactAnnual: 1_356, estimatedAnnual: 756, weightedPrice: 8.85, medikongPrice: 8.4 },
];

const DEMO_PHARMACIES = [
  { pharmacy: "Pharmacie du Centre", brands: ["CeraVe", "Dafalgan", "Mustela"], labs: ["L'Oréal Dermatological Beauty", "UPSA", "Laboratoires Expanscience"], exactAnnual: 816, estimatedAnnual: 264, products: 9, withoutVolume: 1, potentialTarget: 928, potentialMedikong: 1_564 },
  { pharmacy: "Pharmacie Saint-Pierre", brands: ["La Roche-Posay", "CeraVe", "Bepanthen"], labs: ["L'Oréal Dermatological Beauty", "Bayer"], exactAnnual: 624, estimatedAnnual: 396, products: 7, withoutVolume: 2, potentialTarget: 742, potentialMedikong: 1_218 },
  { pharmacy: "Pharmacie des Arts", brands: ["Dafalgan", "Mustela"], labs: ["UPSA", "Laboratoires Expanscience"], exactAnnual: 1_032, estimatedAnnual: 180, products: 6, withoutVolume: 1, potentialTarget: 612, potentialMedikong: 904 },
  { pharmacy: "Pharmacie de la Gare", brands: ["CeraVe", "La Roche-Posay", "Dafalgan", "Bepanthen"], labs: ["L'Oréal Dermatological Beauty", "UPSA", "Bayer"], exactAnnual: 540, estimatedAnnual: 528, products: 8, withoutVolume: 2, potentialTarget: 586, potentialMedikong: 877 },
];

const eur = (value: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
const integer = (value: number) => new Intl.NumberFormat("fr-BE").format(value);

export default function AdminScanPotential() {
  const [threshold, setThreshold] = useState(6);
  const [brand, setBrand] = useState("all");
  const [lab, setLab] = useState("all");

  const brands = useMemo(() => [...new Set(DEMO_PRODUCTS.map((row) => row.brand))].sort(), []);
  const labs = useMemo(() => [...new Set(DEMO_PRODUCTS.map((row) => row.lab))].sort(), []);
  const products = useMemo(() => DEMO_PRODUCTS
    .filter((row) => brand === "all" || row.brand === brand)
    .filter((row) => lab === "all" || row.lab === lab)
    .map((row) => {
      const totalAnnual = row.exactAnnual + row.estimatedAnnual;
      const targetPrice = row.weightedPrice * (1 - threshold / 100);
      const targetPotential = Math.max(0, row.weightedPrice - targetPrice) * totalAnnual;
      const medikongPotential = Math.max(0, row.weightedPrice - row.medikongPrice) * totalAnnual;
      return { ...row, totalAnnual, targetPrice, targetPotential, medikongPotential, potentialGap: medikongPotential - targetPotential };
    })
    .sort((a, b) => b.medikongPotential - a.medikongPotential), [brand, lab, threshold]);

  const pharmacies = useMemo(() => DEMO_PHARMACIES
    .filter((row) => brand === "all" || row.brands.includes(brand))
    .filter((row) => lab === "all" || row.labs.includes(lab))
    .map((row) => ({ ...row, potentialTarget: row.potentialTarget * threshold / 6 }))
    .sort((a, b) => b.potentialMedikong - a.potentialMedikong), [brand, lab, threshold]);

  const totals = useMemo(() => products.reduce((acc, row) => ({
    pharmacies: acc.pharmacies + row.pharmacies,
    volume: acc.volume + row.totalAnnual,
    target: acc.target + row.targetPotential,
    medikong: acc.medikong + row.medikongPotential,
  }), { pharmacies: 0, volume: 0, target: 0, medikong: 0 }), [products]);

  const exportCsv = () => {
    const headers = ["Produit", "Marque", "Laboratoire", "Nb officines", "Sans volume", "Volume exact annuel", "Volume estimé annuel", "Volume total annuel", "Prix payé moyen pondéré", "Prix cible", "Prix MediKong", "Potentiel prix cible", "Potentiel prix MediKong", "Écart potentiels"];
    const rows = products.map((row) => [row.product, row.brand, row.lab, row.pharmacies, row.withoutVolume, row.exactAnnual, row.estimatedAnnual, row.totalAnnual, row.weightedPrice.toFixed(2), row.targetPrice.toFixed(2), row.medikongPrice.toFixed(2), row.targetPotential.toFixed(2), row.medikongPotential.toFixed(2), row.potentialGap.toFixed(2)]);
    const csv = [headers, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "potentiel-scan-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Potentiel par produit" subtitle="Volumes déclarés et opportunités d'achat détectées par Scan" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium"><FlaskConical className="h-4 w-4" /> Données de démonstration</div>
        <span className="text-xs text-muted-foreground">Les comptes de test seront exclus des calculs réels.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Users, label: "Déclarations avec volume", value: integer(Math.max(0, totals.pharmacies - products.reduce((sum, row) => sum + row.withoutVolume, 0))) },
          { icon: TrendingUp, label: "Volume annuel", value: `${integer(totals.volume)} boîtes` },
          { icon: SlidersHorizontal, label: "Potentiel au prix cible", value: eur(totals.target) },
          { icon: TrendingUp, label: "Potentiel au prix MediKong", value: eur(totals.medikong) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-52 space-y-1.5"><label className="text-xs font-medium">Marque</label><Select value={brand} onValueChange={setBrand}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les marques</SelectItem>{brands.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-64 space-y-1.5"><label className="text-xs font-medium">Laboratoire</label><Select value={lab} onValueChange={setLab}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les laboratoires</SelectItem>{labs.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-40 space-y-1.5"><label htmlFor="switch-threshold" className="text-xs font-medium">Seuil de bascule</label><div className="relative"><Input id="switch-threshold" type="number" min={0} max={50} step={0.5} value={threshold} onChange={(event) => setThreshold(Math.max(0, Math.min(50, Number(event.target.value))))} className="pr-8" /><span className="pointer-events-none absolute right-3 top-2.5 text-sm text-muted-foreground">%</span></div></div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList><TabsTrigger value="products">Par produit</TabsTrigger><TabsTrigger value="pharmacies">Par officine</TabsTrigger></TabsList>
        <TabsContent value="products" className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3"><h2 className="font-semibold">Produits classés par potentiel</h2><p className="text-xs text-muted-foreground">Prix moyen pondéré calculé uniquement sur les déclarations avec volume.</p></div>
          <div className="overflow-x-auto"><Table className="min-w-[1500px]"><TableHeader><TableRow>
            {["Produit", "Officines", "Dont sans volume", "Volume exact", "Volume estimé", "Total", "Prix payé moyen", "Prix cible", "Prix MediKong", "Écart prix", "Potentiel cible", "Potentiel MediKong", "Écart potentiels"].map((heading) => <TableHead key={heading} className="whitespace-nowrap">{heading}</TableHead>)}
          </TableRow></TableHeader><TableBody>{products.map((row) => <TableRow key={row.product}>
            <TableCell className="min-w-72"><div className="font-medium">{row.product}</div><div className="text-xs text-muted-foreground">{row.brand} · {row.lab}</div></TableCell>
            <TableCell>{row.pharmacies}</TableCell><TableCell>{row.withoutVolume}</TableCell><TableCell>{integer(row.exactAnnual)}</TableCell><TableCell>{integer(row.estimatedAnnual)}</TableCell><TableCell className="font-semibold">{integer(row.totalAnnual)}</TableCell>
            <TableCell>{eur(row.weightedPrice)}</TableCell><TableCell>{eur(row.targetPrice)}</TableCell><TableCell>{eur(row.medikongPrice)}</TableCell><TableCell><Badge variant={row.medikongPrice < row.targetPrice ? "default" : "secondary"}>{eur(row.targetPrice - row.medikongPrice)}</Badge></TableCell>
            <TableCell>{eur(row.targetPotential)}</TableCell><TableCell className="font-semibold text-primary">{eur(row.medikongPotential)}</TableCell><TableCell className="font-medium">{eur(row.potentialGap)}</TableCell>
          </TableRow>)}</TableBody></Table></div>
        </TabsContent>
        <TabsContent value="pharmacies" className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3"><h2 className="font-semibold">Potentiel par officine</h2><p className="text-xs text-muted-foreground">Synthèse filtrée sur les mêmes marques et laboratoires.</p></div>
          <Table><TableHeader><TableRow>{["Officine", "Produits", "Sans volume", "Volume exact", "Volume estimé", "Total", "Potentiel cible", "Potentiel MediKong", "Écart"].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{pharmacies.map((row) => <TableRow key={row.pharmacy}>
            <TableCell className="font-medium">{row.pharmacy}</TableCell><TableCell>{row.products}</TableCell><TableCell>{row.withoutVolume}</TableCell><TableCell>{integer(row.exactAnnual)}</TableCell><TableCell>{integer(row.estimatedAnnual)}</TableCell><TableCell className="font-semibold">{integer(row.exactAnnual + row.estimatedAnnual)}</TableCell><TableCell>{eur(row.potentialTarget)}</TableCell><TableCell className="font-semibold text-primary">{eur(row.potentialMedikong)}</TableCell><TableCell>{eur(row.potentialMedikong - row.potentialTarget)}</TableCell>
          </TableRow>)}</TableBody></Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}