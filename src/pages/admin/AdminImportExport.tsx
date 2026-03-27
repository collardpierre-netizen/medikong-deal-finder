import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Download, FileText, CheckCircle2, AlertCircle, Clock,
  ArrowRight, RefreshCw, Database, Zap,
} from "lucide-react";

const historyData = [
  { id: "IMP-0047", date: "27/03 14:30", seller: "Pharmamed SRL", file: "catalogue_mars.csv", format: "CSV", lines: 3200, created: 45, updated: 2890, errors: 12, duration: "2m 34s", status: "done" },
  { id: "IMP-0046", date: "27/03 08:00", seller: "MedDistri SA", file: "products_api.json", format: "JSON", lines: 1840, created: 23, updated: 1817, errors: 0, duration: "1m 12s", status: "done" },
  { id: "IMP-0045", date: "26/03 22:00", seller: "Valerco NV", file: "valerco_full.xlsx", format: "XLSX", lines: 698, created: 12, updated: 680, errors: 6, duration: "45s", status: "done" },
  { id: "IMP-0044", date: "26/03 14:15", seller: "Brussels Med", file: "bm_export.xml", format: "XML", lines: 420, created: 8, updated: 408, errors: 4, duration: "38s", status: "done" },
  { id: "IMP-0043", date: "25/03 10:00", seller: "DocMorris scraping", file: "docmorris_be.json", format: "JSON", lines: 2800, created: 120, updated: 2650, errors: 30, duration: "4m 10s", status: "warning" },
  { id: "IMP-0042", date: "24/03 09:00", seller: "Pharmamed SRL", file: "update_prix.csv", format: "CSV", lines: 1500, created: 0, updated: 1485, errors: 15, duration: "55s", status: "done" },
];

const formatColors: Record<string, { bg: string; text: string }> = {
  CSV: { bg: "#ECFDF5", text: "#059669" },
  XML: { bg: "#F3F0FF", text: "#7C3AED" },
  XLSX: { bg: "#EFF6FF", text: "#1B5BDA" },
  JSON: { bg: "#FFFBEB", text: "#D97706" },
};

const mappingFields = [
  { field: "CNK", target: "mpn", required: true },
  { field: "EAN / GTIN", target: "gtin", required: true },
  { field: "Nom produit", target: "product_name", required: true },
  { field: "Marque", target: "brand", required: true },
  { field: "Fabricant", target: "manufacturer", required: false },
  { field: "Catégorie L1", target: "category_l1", required: true },
  { field: "Sous-catégorie L2", target: "category_l2", required: true },
  { field: "Sous-catégorie L3", target: "category_l3", required: false },
  { field: "Prix HT (€)", target: "unit_price_eur", required: true },
  { field: "Taux TVA (%)", target: "tva_rate", required: true },
  { field: "Stock", target: "stock_quantity", required: true },
  { field: "MOQ", target: "bundle_size", required: false },
  { field: "MOV (€)", target: "mov_eur", required: false },
  { field: "Conditionnement", target: "packaging", required: false },
  { field: "Description FR", target: "description_short", required: false },
  { field: "Description NL", target: "description_nl", required: false },
  { field: "Classe MDR", target: "mdr_class", required: false },
];

const autoFeeds = [
  { seller: "Pharmamed SRL", type: "XML Pull", frequency: "2x/jour", lastRun: "27/03 14:30", nextRun: "27/03 20:30", products: 3800, status: "active" },
  { seller: "MedDistri SA", type: "API REST", frequency: "1x/jour", lastRun: "27/03 08:00", nextRun: "28/03 08:00", products: 1840, status: "active" },
  { seller: "Valerco NV", type: "SFTP", frequency: "1x/jour", lastRun: "26/03 22:00", nextRun: "27/03 22:00", products: 698, status: "active" },
  { seller: "DocMorris scraping", type: "Scraping", frequency: "1x/sem", lastRun: "25/03 10:00", nextRun: "01/04 10:00", products: 2800, status: "warning" },
];

const exportTypes = [
  { name: "Catalogue complet", desc: "Tous les produits avec attributs PIM", formats: ["CSV", "XLSX", "JSON"], lastExport: "27/03" },
  { name: "Prix & stocks", desc: "Prix HT, stocks et disponibilités", formats: ["CSV", "XML"], lastExport: "27/03" },
  { name: "Vendeurs", desc: "Liste vendeurs avec KPIs", formats: ["XLSX"], lastExport: "25/03" },
  { name: "Commandes", desc: "Historique commandes B2B", formats: ["CSV", "XLSX"], lastExport: "27/03" },
  { name: "TVA", desc: "Export comptable TVA par catégorie", formats: ["XLSX", "CSV"], lastExport: "01/03" },
  { name: "Conformité", desc: "Registre CE, AFMPS, audits", formats: ["XLSX", "PDF"], lastExport: "15/03" },
];

const wizardSteps = ["Upload", "Détection", "Mapping", "Validation", "Import"];

const AdminImportExport = () => {
  const [tab, setTab] = useState("historique");
  const [wizardStep, setWizardStep] = useState(0);

  return (
    <div>
      <AdminTopBar title="Import / Export" subtitle="Gestion bulk des données catalogue" />

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={Upload} label="Imports ce mois" value="47" evolution={{ value: 12, label: "vs mois dernier" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Database} label="Produits importés" value="28 493" evolution={{ value: 1240, label: "ce mois" }} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={AlertCircle} label="Taux erreur" value="1.2%" evolution={{ value: -0.3, label: "vs mois dernier" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Clock} label="Dernier import" value="27/03 14:30" iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={RefreshCw} label="Prochain auto-import" value="27/03 20:30" iconColor="#E70866" iconBg="#FFF1F3" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="historique" className="text-[13px]">Historique</TabsTrigger>
          <TabsTrigger value="assistant" className="text-[13px]">Assistant import</TabsTrigger>
          <TabsTrigger value="mapping" className="text-[13px]">Mapping</TabsTrigger>
          <TabsTrigger value="auto" className="text-[13px]">Imports auto</TabsTrigger>
          <TabsTrigger value="export" className="text-[13px]">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="historique">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["ID", "Date", "Vendeur", "Fichier", "Format", "Lignes", "Créés", "MAJ", "Erreurs", "Durée", "Statut"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[11px] font-mono font-semibold" style={{ color: "#1B5BDA" }}>{r.id}</TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.date}</TableCell>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{r.seller}</TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.file}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: formatColors[r.format].bg, color: formatColors[r.format].text, borderColor: "transparent" }}>
                        {r.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{r.lines.toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-[11px] text-right font-semibold" style={{ color: "#059669" }}>{r.created}</TableCell>
                    <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{r.updated.toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-[11px] text-right" style={{ color: r.errors > 0 ? "#EF4343" : "#616B7C" }}>{r.errors}</TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.duration}</TableCell>
                    <TableCell>
                      {r.status === "done" ? <CheckCircle2 size={14} style={{ color: "#059669" }} /> : <AlertCircle size={14} style={{ color: "#F59E0B" }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="assistant">
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: "#E2E8F0" }}>
            {/* Wizard steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {wizardSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <button
                    onClick={() => setWizardStep(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                    style={{
                      backgroundColor: i === wizardStep ? "#1B5BDA" : i < wizardStep ? "#ECFDF5" : "#F1F5F9",
                      color: i === wizardStep ? "#fff" : i < wizardStep ? "#059669" : "#8B95A5",
                    }}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{
                      backgroundColor: i === wizardStep ? "rgba(255,255,255,0.2)" : "transparent",
                    }}>
                      {i < wizardStep ? "✓" : i + 1}
                    </span>
                    {s}
                  </button>
                  {i < wizardSteps.length - 1 && <ArrowRight size={14} style={{ color: "#8B95A5" }} />}
                </div>
              ))}
            </div>

            {wizardStep === 0 && (
              <div className="border-2 border-dashed rounded-lg p-12 text-center" style={{ borderColor: "#CBD5E1" }}>
                <Upload size={40} style={{ color: "#8B95A5" }} className="mx-auto mb-3" />
                <p className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Glissez votre fichier ici</p>
                <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>CSV, XML, XLSX ou JSON — max 50 Mo</p>
                <button className="bg-white border px-4 py-2 rounded-md text-[13px] font-medium" style={{ borderColor: "#E2E8F0", color: "#1B5BDA" }}>
                  Parcourir les fichiers
                </button>
              </div>
            )}
            {wizardStep === 1 && (
              <div className="text-center py-8">
                <RefreshCw size={32} className="animate-spin mx-auto mb-3" style={{ color: "#1B5BDA" }} />
                <p className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Détection du format en cours...</p>
                <p className="text-[12px]" style={{ color: "#8B95A5" }}>Analyse des colonnes et types de données</p>
              </div>
            )}
            {wizardStep === 2 && (
              <div className="text-center py-8">
                <Database size={32} className="mx-auto mb-3" style={{ color: "#7C3AED" }} />
                <p className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Mapping des colonnes</p>
                <p className="text-[12px]" style={{ color: "#8B95A5" }}>Associez les colonnes du fichier aux champs MediKong</p>
              </div>
            )}
            {wizardStep === 3 && (
              <div className="text-center py-8">
                <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "#059669" }} />
                <p className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Validation des données</p>
                <p className="text-[12px]" style={{ color: "#8B95A5" }}>3 200 lignes valides — 12 erreurs détectées</p>
              </div>
            )}
            {wizardStep === 4 && (
              <div className="text-center py-8">
                <Zap size={32} className="mx-auto mb-3" style={{ color: "#F59E0B" }} />
                <p className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>Import en cours...</p>
                <Progress value={67} className="max-w-xs mx-auto mt-3 h-2" />
                <p className="text-[12px] mt-2" style={{ color: "#8B95A5" }}>2 144 / 3 200 lignes traitées</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mapping">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Champ source</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Champ cible</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappingFields.map((f) => (
                  <TableRow key={f.field}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{f.field}</TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#7C3AED" }}>{f.target}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: f.required ? "#EF4343" : "#059669",
                        borderColor: f.required ? "#FECACA" : "#BBF7D0",
                        backgroundColor: f.required ? "#FEF2F2" : "#ECFDF5",
                      }}>
                        {f.required ? "Obligatoire" : "Optionnel"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="auto">
          <div className="space-y-3">
            {autoFeeds.map((f) => (
              <div key={f.seller} className="bg-white rounded-lg border p-5 flex items-center gap-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: f.status === "active" ? "#ECFDF5" : "#FFFBEB" }}>
                  <RefreshCw size={18} style={{ color: f.status === "active" ? "#059669" : "#F59E0B" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{f.seller}</span>
                    <Badge variant="outline" className="text-[10px]" style={{ color: "#7C3AED", borderColor: "#DDD6FE" }}>{f.type}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-[11px]" style={{ color: "#8B95A5" }}>
                    <span>Fréq: {f.frequency}</span>
                    <span>Dernier: {f.lastRun}</span>
                    <span>Prochain: {f.nextRun}</span>
                    <span>{f.products.toLocaleString("fr-BE")} produits</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]" style={{
                  color: f.status === "active" ? "#059669" : "#F59E0B",
                  borderColor: f.status === "active" ? "#BBF7D0" : "#FDE68A",
                  backgroundColor: f.status === "active" ? "#ECFDF5" : "#FFFBEB",
                }}>
                  {f.status === "active" ? "Actif" : "Attention"}
                </Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="export">
          <div className="grid grid-cols-2 gap-4">
            {exportTypes.map((e) => (
              <div key={e.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Download size={16} style={{ color: "#1B5BDA" }} />
                  <span className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>{e.name}</span>
                </div>
                <p className="text-[12px] mb-3" style={{ color: "#8B95A5" }}>{e.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {e.formats.map(f => (
                      <button key={f} className="px-2.5 py-1 rounded text-[10px] font-bold" style={{
                        backgroundColor: formatColors[f]?.bg || "#F1F5F9",
                        color: formatColors[f]?.text || "#616B7C",
                      }}>
                        {f}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px]" style={{ color: "#8B95A5" }}>Dernier: {e.lastExport}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminImportExport;
