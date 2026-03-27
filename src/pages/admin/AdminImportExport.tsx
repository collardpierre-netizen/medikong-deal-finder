import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useImportJobs } from "@/hooks/useAdminData";
import {
  Upload, Download, FileText, CheckCircle2, AlertCircle, Clock,
  ArrowRight, RefreshCw, Database, Zap,
} from "lucide-react";

const formatColors: Record<string, { bg: string; text: string }> = {
  CSV: { bg: "#ECFDF5", text: "#059669" },
  XML: { bg: "#F3F0FF", text: "#7C3AED" },
  XLSX: { bg: "#EFF6FF", text: "#1B5BDA" },
  JSON: { bg: "#FFFBEB", text: "#D97706" },
};

const exportTypes = [
  { name: "Catalogue complet", desc: "Tous les produits avec attributs PIM", formats: ["CSV", "XLSX", "JSON"] },
  { name: "Prix & stocks", desc: "Prix HT, stocks et disponibilités", formats: ["CSV", "XML"] },
  { name: "Vendeurs", desc: "Liste vendeurs avec KPIs", formats: ["XLSX"] },
  { name: "Commandes", desc: "Historique commandes B2B", formats: ["CSV", "XLSX"] },
  { name: "TVA", desc: "Export comptable TVA par catégorie", formats: ["XLSX", "CSV"] },
  { name: "Conformité", desc: "Registre CE, AFMPS, audits", formats: ["XLSX"] },
];

const wizardSteps = ["Upload", "Détection", "Mapping", "Validation", "Import"];

const AdminImportExport = () => {
  const [tab, setTab] = useState("historique");
  const [wizardStep, setWizardStep] = useState(0);
  const { data: importJobs = [], isLoading } = useImportJobs();

  const totalImported = importJobs.reduce((a, j) => a + (j.rows_created || 0) + (j.rows_updated || 0), 0);
  const errorRate = importJobs.length > 0
    ? ((importJobs.reduce((a, j) => a + (j.rows_errors || 0), 0) / Math.max(1, importJobs.reduce((a, j) => a + (j.rows_total || 0), 0))) * 100).toFixed(1)
    : "0";
  const lastImport = importJobs[0] ? new Date(importJobs[0].created_at).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div>
      <AdminTopBar title="Import / Export" subtitle="Gestion bulk des données catalogue" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Upload} label="Imports total" value={String(importJobs.length)} evolution={{ value: 12, label: "ce mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Database} label="Lignes importées" value={totalImported.toLocaleString("fr-BE")} iconColor="#7C3AED" iconBg="#F3F0FF" />
        <KpiCard icon={AlertCircle} label="Taux erreur" value={`${errorRate}%`} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={Clock} label="Dernier import" value={lastImport} iconColor="#059669" iconBg="#ECFDF5" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="historique" className="text-[13px]">Historique</TabsTrigger>
          <TabsTrigger value="assistant" className="text-[13px]">Assistant import</TabsTrigger>
          <TabsTrigger value="export" className="text-[13px]">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="historique">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                    {["Date", "Vendeur", "Fichier", "Format", "Lignes", "Créés", "MAJ", "Erreurs", "Durée", "Statut"].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importJobs.map((j) => {
                    const fc = formatColors[j.format] || formatColors.CSV;
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>
                          {new Date(j.created_at).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{(j.vendors as any)?.company_name || "—"}</TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{j.file_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: fc.bg, color: fc.text, borderColor: "transparent" }}>{j.format}</Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{(j.rows_total || 0).toLocaleString("fr-BE")}</TableCell>
                        <TableCell className="text-[11px] text-right font-semibold" style={{ color: "#059669" }}>{j.rows_created || 0}</TableCell>
                        <TableCell className="text-[11px] text-right" style={{ color: "#616B7C" }}>{(j.rows_updated || 0).toLocaleString("fr-BE")}</TableCell>
                        <TableCell className="text-[11px] text-right" style={{ color: (j.rows_errors || 0) > 0 ? "#EF4343" : "#616B7C" }}>{j.rows_errors || 0}</TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{j.duration_seconds ? `${j.duration_seconds}s` : "—"}</TableCell>
                        <TableCell>
                          {j.status === "done" ? <CheckCircle2 size={14} style={{ color: "#059669" }} /> :
                            j.status === "error" ? <AlertCircle size={14} style={{ color: "#EF4343" }} /> :
                            <Clock size={14} style={{ color: "#F59E0B" }} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!isLoading && importJobs.length === 0 && (
              <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucun import enregistré</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="assistant">
          <div className="bg-white rounded-lg border p-6" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center justify-center gap-2 mb-8">
              {wizardSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <button onClick={() => setWizardStep(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                    style={{ backgroundColor: i === wizardStep ? "#1B5BDA" : i < wizardStep ? "#ECFDF5" : "#F1F5F9", color: i === wizardStep ? "#fff" : i < wizardStep ? "#059669" : "#8B95A5" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: i === wizardStep ? "rgba(255,255,255,0.2)" : "transparent" }}>
                      {i < wizardStep ? "✓" : i + 1}
                    </span>
                    {s}
                  </button>
                  {i < wizardSteps.length - 1 && <ArrowRight size={14} style={{ color: "#8B95A5" }} />}
                </div>
              ))}
            </div>
            <div className="border-2 border-dashed rounded-lg p-12 text-center" style={{ borderColor: "#CBD5E1" }}>
              <Upload size={40} style={{ color: "#8B95A5" }} className="mx-auto mb-3" />
              <p className="text-[14px] font-semibold mb-1" style={{ color: "#1D2530" }}>Glissez votre fichier ici</p>
              <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>CSV, XML, XLSX ou JSON — max 50 Mo</p>
              <button className="bg-white border px-4 py-2 rounded-md text-[13px] font-medium" style={{ borderColor: "#E2E8F0", color: "#1B5BDA" }}>Parcourir les fichiers</button>
            </div>
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
                <div className="flex gap-1.5">
                  {e.formats.map(f => (
                    <button key={f} className="px-2.5 py-1 rounded text-[10px] font-bold" style={{
                      backgroundColor: formatColors[f]?.bg || "#F1F5F9",
                      color: formatColors[f]?.text || "#616B7C",
                    }}>{f}</button>
                  ))}
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
