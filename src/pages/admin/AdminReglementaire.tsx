import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useComplianceRecords } from "@/hooks/useAdminData";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Calendar, FileText,
  Clock, RefreshCw, Activity,
} from "lucide-react";

const mdrClassColors: Record<string, { bg: string; text: string }> = {
  "I": { bg: "#ECFDF5", text: "#059669" },
  "IIa": { bg: "#EFF6FF", text: "#1B5BDA" },
  "IIb": { bg: "#FFFBEB", text: "#D97706" },
  "III": { bg: "#FEF2F2", text: "#EF4343" },
};

const riskColors: Record<string, { bg: string; text: string }> = {
  LOW: { bg: "#ECFDF5", text: "#059669" },
  MEDIUM: { bg: "#FFFBEB", text: "#D97706" },
  HIGH: { bg: "#FEF2F2", text: "#EF4343" },
  CRITICAL: { bg: "#FEE2E2", text: "#DC2626" },
};

const afmpsColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#ECFDF5", text: "#059669", label: "Actif" },
  renouvellement: { bg: "#FFFBEB", text: "#D97706", label: "Renouvellement" },
  expire: { bg: "#FEF2F2", text: "#EF4343", label: "Expiré" },
};

const AdminReglementaire = () => {
  const [tab, setTab] = useState("registre");
  const { data: complianceData = [], isLoading } = useComplianceRecords();

  const hasCritical = complianceData.some(r => r.risk_level === "CRITICAL");
  const conformeCount = complianceData.filter(r => r.ce_marked && r.afmps_status === "active").length;
  const renewalCount = complianceData.filter(r => r.afmps_status === "renouvellement").length;
  const expiredCount = complianceData.filter(r => !r.ce_marked || r.afmps_status === "expire").length;
  const auditCount = complianceData.filter(r => r.next_audit).length;

  const criticalRecord = complianceData.find(r => r.risk_level === "CRITICAL");

  return (
    <div>
      <AdminTopBar title="Conformité réglementaire" subtitle="Surveillance MDR, AFMPS et certifications" />

      {hasCritical && criticalRecord && (
        <div className="flex items-center gap-3 p-4 rounded-lg mb-5" style={{ backgroundColor: "#FEE2E2", border: "1px solid #FECACA" }}>
          <AlertTriangle size={20} style={{ color: "#DC2626" }} />
          <div className="flex-1">
            <span className="text-[13px] font-bold" style={{ color: "#DC2626" }}>Certification CE expirée détectée</span>
            <p className="text-[12px]" style={{ color: "#991B1B" }}>
              {(criticalRecord.products as any)?.product_name || "Produit"} — Action requise : désactiver le produit.
            </p>
          </div>
          <button className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>Désactiver</button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={Shield} label="Produits conformes" value={String(conformeCount)} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={RefreshCw} label="Renouvellements" value={String(renewalCount)} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={XCircle} label="Certif. expirées" value={String(expiredCount)} iconColor="#EF4343" iconBg="#FEF2F2" />
        <KpiCard icon={Calendar} label="Prochains audits" value={String(auditCount)} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Activity} label="Classes MDR" value="I / IIa / IIb / III" iconColor="#7C3AED" iconBg="#F3F0FF" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="registre" className="text-[13px]">Registre</TabsTrigger>
          <TabsTrigger value="calendrier" className="text-[13px]">Calendrier</TabsTrigger>
        </TabsList>

        <TabsContent value="registre">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                    {["Produit", "Catégorie", "Classe MDR", "CE", "Exp. CE", "N° AFMPS", "Statut AFMPS", "Audit", "Risque"].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceData.map((r) => {
                    const mdrClass = r.mdr_class || "I";
                    const risk = r.risk_level || "LOW";
                    const afmpsStatus = r.afmps_status || "active";
                    return (
                      <TableRow key={r.id} style={risk === "CRITICAL" ? { backgroundColor: "#FEF2F2" } : {}}>
                        <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{(r.products as any)?.product_name || "—"}</TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{(r.products as any)?.category_l1 || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: (mdrClassColors[mdrClass] || mdrClassColors.I).bg, color: (mdrClassColors[mdrClass] || mdrClassColors.I).text, borderColor: "transparent" }}>
                            {mdrClass}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.ce_marked ? <CheckCircle2 size={15} style={{ color: "#059669" }} /> : <XCircle size={15} style={{ color: "#EF4343" }} />}</TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.ce_expiry ? new Date(r.ce_expiry).toLocaleDateString("fr-BE") : "—"}</TableCell>
                        <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{r.afmps_notification || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: (afmpsColors[afmpsStatus] || afmpsColors.active).bg, color: (afmpsColors[afmpsStatus] || afmpsColors.active).text, borderColor: "transparent" }}>
                            {(afmpsColors[afmpsStatus] || afmpsColors.active).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.next_audit ? new Date(r.next_audit).toLocaleDateString("fr-BE") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: (riskColors[risk] || riskColors.LOW).bg, color: (riskColors[risk] || riskColors.LOW).text, borderColor: "transparent" }}>
                            {risk}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendrier">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Prochains événements</h3>
            <div className="space-y-3">
              {complianceData.filter(r => r.next_audit || r.ce_expiry).slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF" }}>
                    <Calendar size={16} style={{ color: "#1B5BDA" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{(r.products as any)?.product_name || "Produit"}</p>
                    <p className="text-[11px]" style={{ color: "#8B95A5" }}>
                      {r.next_audit ? `Audit: ${new Date(r.next_audit).toLocaleDateString("fr-BE")}` : ""}
                      {r.ce_expiry ? ` · CE expire: ${new Date(r.ce_expiry).toLocaleDateString("fr-BE")}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminReglementaire;
