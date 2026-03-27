import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Calendar, FileText,
  Clock, RefreshCw, Activity,
} from "lucide-react";

const registreData = [
  { product: "Gants nitrile Aurelia x200", category: "EPI", classeMDR: "I", ce: true, ceExpiry: "15/08/2026", afmps: "AFMPS-DM-2024-1245", afmpsStatus: "active", nextAudit: "01/09/2026", risk: "LOW" },
  { product: "Sekusept Aktiv 6kg", category: "Désinfection", classeMDR: "IIa", ce: true, ceExpiry: "22/03/2027", afmps: "AFMPS-DM-2023-0892", afmpsStatus: "active", nextAudit: "15/04/2027", risk: "LOW" },
  { product: "Masques FFP2 Kolmi x50", category: "EPI", classeMDR: "III", ce: true, ceExpiry: "10/06/2025", afmps: "AFMPS-DM-2022-0341", afmpsStatus: "renouvellement", nextAudit: "01/07/2025", risk: "HIGH" },
  { product: "Tensoval Comfort", category: "Diagnostic", classeMDR: "IIa", ce: true, ceExpiry: "30/11/2026", afmps: "AFMPS-DM-2024-0567", afmpsStatus: "active", nextAudit: "01/12/2026", risk: "LOW" },
  { product: "Compresses stériles 10x10", category: "Pansements", classeMDR: "I", ce: false, ceExpiry: "01/02/2025", afmps: "AFMPS-DM-2021-0123", afmpsStatus: "expire", nextAudit: "—", risk: "CRITICAL" },
  { product: "Omron M3 Comfort", category: "Diagnostic", classeMDR: "IIa", ce: true, ceExpiry: "18/09/2026", afmps: "AFMPS-DM-2024-0890", afmpsStatus: "active", nextAudit: "01/10/2026", risk: "LOW" },
  { product: "Mepilex Border 10x10 x5", category: "Pansements", classeMDR: "IIb", ce: true, ceExpiry: "05/04/2026", afmps: "AFMPS-DM-2023-0445", afmpsStatus: "active", nextAudit: "01/05/2026", risk: "MEDIUM" },
  { product: "Cathéter Foley 16Fr", category: "Instruments", classeMDR: "IIa", ce: true, ceExpiry: "12/07/2025", afmps: "AFMPS-DM-2022-0678", afmpsStatus: "renouvellement", nextAudit: "15/08/2025", risk: "HIGH" },
];

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

const calendarEvents = [
  { date: "01/04/2025", type: "audit", label: "Audit ISO 13485 — Valerco NV" },
  { date: "10/06/2025", type: "expiry", label: "Expiration CE — Masques FFP2 Kolmi" },
  { date: "12/07/2025", type: "expiry", label: "Expiration CE — Cathéter Foley 16Fr" },
  { date: "15/08/2025", type: "audit", label: "Audit AFMPS — Cathéter Foley 16Fr" },
  { date: "01/09/2026", type: "audit", label: "Audit CE — Gants nitrile Aurelia" },
  { date: "01/05/2026", type: "audit", label: "Audit CE — Mepilex Border" },
];

const reglementations = [
  { name: "MDR 2017/745", scope: "Dispositifs médicaux", status: "En vigueur", applies: ["Classe I", "IIa", "IIb", "III"], key: "Marquage CE, évaluation clinique, traçabilité UDI" },
  { name: "IVDR 2017/746", scope: "Dispositifs in vitro", status: "En vigueur", applies: ["DIV"], key: "Classification A/B/C/D, auto-tests, évaluation performance" },
  { name: "AFMPS/FAMHP", scope: "Belgique — tous DM", status: "Obligatoire", applies: ["Tous"], key: "Notification préalable, vigilance, distribution en gros" },
  { name: "Eudamed", scope: "UE — enregistrement", status: "Partiellement actif", applies: ["Tous DM"], key: "Base de données UE, UDI-DI, certificats" },
  { name: "Cosmétiques (EC 1223/2009)", scope: "Produits cosmétiques", status: "En vigueur", applies: ["Cosmétiques"], key: "CPNP notification, personne responsable, DIP" },
  { name: "Compléments (2002/46/CE)", scope: "Compléments alimentaires", status: "En vigueur", applies: ["Compléments"], key: "Notification SPF Santé, étiquetage, allégations" },
];

const checklistDocs = [
  { name: "Licence grossiste AFMPS", obligatoire: true, desc: "Distribution en gros de dispositifs médicaux" },
  { name: "Certificat CE (par produit)", obligatoire: true, desc: "Marquage CE valide, organisme notifié" },
  { name: "Notification AFMPS", obligatoire: true, desc: "Enregistrement mise sur le marché belge" },
  { name: "Assurance RC Pro (≥ 2.5M €)", obligatoire: true, desc: "Couverture responsabilité civile professionnelle" },
  { name: "Traçabilité lots", obligatoire: true, desc: "Système de traçabilité amont/aval par lot" },
  { name: "Personne responsable", obligatoire: true, desc: "Personne qualifiée désignée (GPSR)" },
  { name: "ISO 13485", obligatoire: false, desc: "Système de management qualité dispositifs médicaux" },
  { name: "Plan de vigilance", obligatoire: false, desc: "Procédure de signalement incidents et FSCA" },
];

const hasCritical = registreData.some(r => r.risk === "CRITICAL");

const AdminReglementaire = () => {
  const [tab, setTab] = useState("registre");

  return (
    <div>
      <AdminTopBar title="Conformité réglementaire" subtitle="Surveillance MDR, AFMPS et certifications" />

      {hasCritical && (
        <div className="flex items-center gap-3 p-4 rounded-lg mb-5" style={{ backgroundColor: "#FEE2E2", border: "1px solid #FECACA" }}>
          <AlertTriangle size={20} style={{ color: "#DC2626" }} />
          <div className="flex-1">
            <span className="text-[13px] font-bold" style={{ color: "#DC2626" }}>Certification CE expirée détectée</span>
            <p className="text-[12px]" style={{ color: "#991B1B" }}>Compresses stériles 10x10 — CE expiré le 01/02/2025. Action requise : désactiver le produit immédiatement.</p>
          </div>
          <button className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white" style={{ backgroundColor: "#DC2626" }}>Désactiver</button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard icon={Shield} label="Produits conformes" value="12 634" evolution={{ value: 2, label: "vs mois dernier" }} iconColor="#059669" iconBg="#ECFDF5" />
        <KpiCard icon={RefreshCw} label="Renouvellements requis" value="23" evolution={{ value: 8, label: "dans 90j" }} iconColor="#F59E0B" iconBg="#FFFBEB" />
        <KpiCard icon={XCircle} label="Certifications expirées" value="3" iconColor="#EF4343" iconBg="#FEF2F2" />
        <KpiCard icon={Calendar} label="Prochains audits" value="6" evolution={{ value: 0, label: "dans 6 mois" }} iconColor="#1B5BDA" iconBg="#EFF6FF" />
        <KpiCard icon={Activity} label="Classes MDR" value="I / IIa / IIb / III" iconColor="#7C3AED" iconBg="#F3F0FF" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="registre" className="text-[13px]">Registre</TabsTrigger>
          <TabsTrigger value="calendrier" className="text-[13px]">Calendrier</TabsTrigger>
          <TabsTrigger value="reglementation" className="text-[13px]">Réglementation BE</TabsTrigger>
          <TabsTrigger value="checklist" className="text-[13px]">Checklist vendeurs</TabsTrigger>
        </TabsList>

        <TabsContent value="registre">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Produit", "Catégorie", "Classe MDR", "CE", "Exp. CE", "N° AFMPS", "Statut AFMPS", "Audit", "Risque"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {registreData.map((r) => (
                  <TableRow key={r.afmps} style={r.risk === "CRITICAL" ? { backgroundColor: "#FEF2F2" } : {}}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{r.product}</TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: mdrClassColors[r.classeMDR].bg, color: mdrClassColors[r.classeMDR].text, borderColor: "transparent" }}>
                        {r.classeMDR}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.ce ? <CheckCircle2 size={15} style={{ color: "#059669" }} /> : <XCircle size={15} style={{ color: "#EF4343" }} />}</TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.ceExpiry}</TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{r.afmps}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: afmpsColors[r.afmpsStatus].bg, color: afmpsColors[r.afmpsStatus].text, borderColor: "transparent" }}>
                        {afmpsColors[r.afmpsStatus].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{r.nextAudit}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: riskColors[r.risk].bg, color: riskColors[r.risk].text, borderColor: "transparent" }}>
                        {r.risk}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="calendrier">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#1D2530" }}>Prochains événements</h3>
            <div className="space-y-3">
              {calendarEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg" style={{ backgroundColor: "#F8FAFC" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{
                    backgroundColor: e.type === "expiry" ? "#FEF2F2" : "#EFF6FF"
                  }}>
                    {e.type === "expiry" ? <Clock size={16} style={{ color: "#EF4343" }} /> : <Calendar size={16} style={{ color: "#1B5BDA" }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium" style={{ color: "#1D2530" }}>{e.label}</p>
                    <p className="text-[11px]" style={{ color: "#8B95A5" }}>{e.date}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: e.type === "expiry" ? "#EF4343" : "#1B5BDA",
                    borderColor: e.type === "expiry" ? "#FECACA" : "#DBEAFE",
                  }}>
                    {e.type === "expiry" ? "Expiration" : "Audit"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reglementation">
          <div className="space-y-3">
            {reglementations.map((r) => (
              <div key={r.name} className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield size={16} style={{ color: "#1B5BDA" }} />
                    <span className="text-[14px] font-bold" style={{ color: "#1D2530" }}>{r.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]" style={{ color: "#059669", borderColor: "#BBF7D0" }}>{r.status}</Badge>
                </div>
                <p className="text-[12px] mb-2" style={{ color: "#616B7C" }}>{r.scope}</p>
                <div className="flex gap-1.5 mb-2">
                  {r.applies.map(a => (
                    <span key={a} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F1F5F9", color: "#616B7C" }}>{a}</span>
                  ))}
                </div>
                <p className="text-[11px]" style={{ color: "#8B95A5" }}>{r.key}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="checklist">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Document</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Type</TableHead>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklistDocs.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>
                      <div className="flex items-center gap-2">
                        <FileText size={14} style={{ color: d.obligatoire ? "#1B5BDA" : "#8B95A5" }} />
                        {d.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: d.obligatoire ? "#EF4343" : "#059669",
                        borderColor: d.obligatoire ? "#FECACA" : "#BBF7D0",
                        backgroundColor: d.obligatoire ? "#FEF2F2" : "#ECFDF5",
                      }}>
                        {d.obligatoire ? "Obligatoire" : "Recommandé"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{d.desc}</TableCell>
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

export default AdminReglementaire;
