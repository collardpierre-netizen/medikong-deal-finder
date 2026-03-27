import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tag, Factory, Package, DollarSign, Star, Shield,
  TrendingUp, ExternalLink, Award,
} from "lucide-react";

const brandsData = [
  { name: "TENA", manufacturer: "Essity AB", country: "Suède", products: 89, gmv: 18400, tier: "Strategic", rating: 4.8, growth: 12, certCE: true, topProducts: ["TENA Comfort", "TENA Slip", "TENA Lady"] },
  { name: "Hartmann", manufacturer: "Paul Hartmann AG", country: "Allemagne", products: 124, gmv: 22800, tier: "Strategic", rating: 4.7, growth: 8, certCE: true, topProducts: ["Compresses stériles", "Peha-soft nitrile", "Cosmopor"] },
  { name: "Nutricia", manufacturer: "Danone", country: "Pays-Bas", products: 67, gmv: 14200, tier: "Gold", rating: 4.6, growth: 15, certCE: false, topProducts: ["Fortimel", "Nutrison", "Cubitan"] },
  { name: "EUCERIN", manufacturer: "Beiersdorf AG", country: "Allemagne", products: 43, gmv: 9800, tier: "Silver", rating: 4.5, growth: 6, certCE: false, topProducts: ["Aquaphor", "Urea Repair", "DermatoCLEAN"] },
  { name: "Hansaplast", manufacturer: "Beiersdorf AG", country: "Allemagne", products: 31, gmv: 6200, tier: "Silver", rating: 4.3, growth: 4, certCE: true, topProducts: ["Sensitive", "Elastic", "Sport"] },
  { name: "Kolmi", manufacturer: "Kolmi-Hopen", country: "France", products: 28, gmv: 5800, tier: "Gold", rating: 4.4, growth: 22, certCE: true, topProducts: ["FFP2 Op-Air", "Masques chirurgicaux", "Masques enfant"] },
  { name: "Aurelia", manufacturer: "Supermax Corp.", country: "Malaisie", products: 18, gmv: 4200, tier: "Bronze", rating: 4.1, growth: -3, certCE: true, topProducts: ["Bold nitrile", "Sonic nitrile", "Transform"] },
  { name: "Omron", manufacturer: "Omron Healthcare", country: "Japon", products: 22, gmv: 7600, tier: "Gold", rating: 4.7, growth: 10, certCE: true, topProducts: ["M3 Comfort", "M7 Intelli IT", "Evolv"] },
];

const manufacturersData = [
  { name: "Essity AB", country: "Suède", brands: ["TENA", "Leukoplast", "BSN", "MoliCare", "Cutimed"], products: 312, gmv: 42600, tier: "Strategic" },
  { name: "Paul Hartmann AG", country: "Allemagne", brands: ["Hartmann", "Bode", "MediSet"], products: 289, gmv: 35200, tier: "Strategic" },
  { name: "Beiersdorf AG", country: "Allemagne", brands: ["EUCERIN", "Hansaplast", "Elastoplast"], products: 74, gmv: 16000, tier: "Gold" },
  { name: "Danone", country: "Pays-Bas", brands: ["Nutricia", "Fortimel", "Nutrison"], products: 67, gmv: 14200, tier: "Gold" },
  { name: "B. Braun Melsungen", country: "Allemagne", brands: ["B.Braun", "Aesculap", "Sutures"], products: 312, gmv: 28400, tier: "Strategic" },
  { name: "Mölnlycke Health Care", country: "Suède", brands: ["Mölnlycke", "Mepilex", "Biogel"], products: 178, gmv: 21800, tier: "Gold" },
  { name: "Omron Healthcare", country: "Japon", brands: ["Omron"], products: 22, gmv: 7600, tier: "Gold" },
  { name: "Kolmi-Hopen", country: "France", brands: ["Kolmi", "Op-Air"], products: 28, gmv: 5800, tier: "Silver" },
];

const tierColors: Record<string, { bg: string; text: string }> = {
  Strategic: { bg: "#FCE7F3", text: "#BE185D" },
  Platinum: { bg: "#EDE9FE", text: "#7C3AED" },
  Gold: { bg: "#FEF9C3", text: "#A16207" },
  Silver: { bg: "#F1F5F9", text: "#475569" },
  Bronze: { bg: "#FEF3C7", text: "#92400E" },
};

const fmt = (n: number) => n.toLocaleString("fr-BE");

const AdminMarques = () => {
  const [tab, setTab] = useState("marques");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const selected = brandsData.find(b => b.name === selectedBrand);

  return (
    <div>
      <AdminTopBar title="Marques & Fabricants" subtitle="Gestion du portefeuille marques" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Tag} label="Marques actives" value={String(brandsData.length)} evolution={{ value: 2, label: "ce mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Factory} label="Fabricants" value={String(manufacturersData.length)} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={Package} label="Produits total" value={fmt(brandsData.reduce((a, b) => a + b.products, 0))} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={DollarSign} label="GMV marques" value={`€${fmt(brandsData.reduce((a, b) => a + b.gmv, 0))}`} evolution={{ value: 11, label: "vs mois dernier" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="marques" className="text-[13px]">Marques</TabsTrigger>
          <TabsTrigger value="fabricants" className="text-[13px]">Fabricants</TabsTrigger>
        </TabsList>

        <TabsContent value="marques">
          <div className="flex gap-4">
            {/* Brands table */}
            <div className={`bg-white rounded-lg border overflow-hidden ${selectedBrand ? "flex-1" : "w-full"}`} style={{ borderColor: "#E2E8F0" }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                    {["Marque", "Fabricant", "Pays", "Produits", "GMV mois", "Tier", "Rating", "Croiss.", "CE"].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brandsData.map((b) => (
                    <TableRow
                      key={b.name}
                      className="cursor-pointer hover:bg-blue-50/50"
                      onClick={() => setSelectedBrand(selectedBrand === b.name ? null : b.name)}
                      style={selectedBrand === b.name ? { backgroundColor: "#EFF6FF" } : {}}
                    >
                      <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{b.name}</TableCell>
                      <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{b.manufacturer}</TableCell>
                      <TableCell className="text-[11px]" style={{ color: "#8B95A5" }}>{b.country}</TableCell>
                      <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{b.products}</TableCell>
                      <TableCell className="text-[11px] text-right font-semibold" style={{ color: "#059669" }}>€{fmt(b.gmv)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: tierColors[b.tier].bg, color: tierColors[b.tier].text, borderColor: "transparent" }}>
                          {b.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px]" style={{ color: "#F59E0B" }}>
                        <span className="flex items-center gap-1"><Star size={10} fill="currentColor" />{b.rating}</span>
                      </TableCell>
                      <TableCell className="text-[11px] font-semibold" style={{ color: b.growth >= 0 ? "#059669" : "#EF4343" }}>
                        {b.growth > 0 ? "+" : ""}{b.growth}%
                      </TableCell>
                      <TableCell>
                        {b.certCE ? <Shield size={13} style={{ color: "#059669" }} /> : <span className="text-[10px]" style={{ color: "#8B95A5" }}>—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Brand detail sidebar */}
            {selected && (
              <div className="w-[300px] bg-white rounded-lg border p-5 shrink-0" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-bold" style={{ color: "#1D2530" }}>{selected.name}</h3>
                  <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: tierColors[selected.tier].bg, color: tierColors[selected.tier].text, borderColor: "transparent" }}>
                    {selected.tier}
                  </Badge>
                </div>

                <div className="space-y-3 text-[12px] mb-4">
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Fabricant</span><span className="font-medium" style={{ color: "#1D2530" }}>{selected.manufacturer}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Pays</span><span style={{ color: "#1D2530" }}>{selected.country}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Produits</span><span style={{ color: "#1D2530" }}>{selected.products}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>GMV mois</span><span className="font-semibold" style={{ color: "#059669" }}>€{fmt(selected.gmv)}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Rating</span><span style={{ color: "#F59E0B" }}>★ {selected.rating}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#8B95A5" }}>Croissance</span><span style={{ color: selected.growth >= 0 ? "#059669" : "#EF4343" }}>{selected.growth > 0 ? "+" : ""}{selected.growth}%</span></div>
                </div>

                <div className="mb-4">
                  <span className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Top produits</span>
                  <div className="mt-2 space-y-1.5">
                    {selected.topProducts.map((p) => (
                      <div key={p} className="text-[12px] px-2.5 py-1.5 rounded" style={{ backgroundColor: "#F8FAFC", color: "#1D2530" }}>{p}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Certifications</span>
                  <div className="mt-2 flex gap-1.5">
                    {selected.certCE && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>CE</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>AFMPS</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="fabricants">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Fabricant", "Pays", "Marques", "Produits", "GMV mois", "Tier"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {manufacturersData.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                      <div className="flex items-center gap-2">
                        <Factory size={14} style={{ color: "#7C3AED" }} />
                        {m.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#8B95A5" }}>{m.country}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {m.brands.map(b => (
                          <span key={b} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EFF6FF", color: "#1B5BDA" }}>{b}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{m.products}</TableCell>
                    <TableCell className="text-[11px] text-right font-semibold" style={{ color: "#059669" }}>€{fmt(m.gmv)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: tierColors[m.tier].bg, color: tierColors[m.tier].text, borderColor: "transparent" }}>
                        {m.tier}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMarques;
