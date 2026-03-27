import AdminTopBar from "@/components/admin/AdminTopBar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const roleColors: Record<string, { bg: string; text: string }> = {
  "Super Admin": { bg: "#FEF2F2", text: "#EF4343" },
  "Admin": { bg: "#EFF6FF", text: "#1B5BDA" },
  "Modérateur": { bg: "#F3F0FF", text: "#7C3AED" },
  "Support": { bg: "#ECFDF5", text: "#059669" },
  "Comptable": { bg: "#FFFBEB", text: "#D97706" },
};

const moduleColors: Record<string, { bg: string; text: string }> = {
  Vendeurs: { bg: "#EFF6FF", text: "#1B5BDA" },
  Produits: { bg: "#F3F0FF", text: "#7C3AED" },
  Commandes: { bg: "#ECFDF5", text: "#059669" },
  Litiges: { bg: "#FEF2F2", text: "#EF4343" },
  Finances: { bg: "#FFFBEB", text: "#D97706" },
  CRM: { bg: "#FCE7F3", text: "#BE185D" },
  Paramètres: { bg: "#F1F5F9", text: "#475569" },
};

const logs = [
  { timestamp: "27/03 14:32:18", user: "Pierre Collard", role: "Super Admin", action: "Validation vendeur Brussels Med → Actif", module: "Vendeurs", ip: "81.246.12.45" },
  { timestamp: "27/03 14:15:02", user: "Sophie Martin", role: "Admin", action: "Modération produit #PRD-4521 approuvé", module: "Produits", ip: "91.182.34.78" },
  { timestamp: "27/03 13:48:55", user: "Marc Dubois", role: "Modérateur", action: "Litige CLM-012 → Résolu (remboursement partiel)", module: "Litiges", ip: "85.14.192.33" },
  { timestamp: "27/03 11:22:10", user: "Julie Petit", role: "Support", action: "Message envoyé à Pharmacie Delvaux (suivi commande)", module: "CRM", ip: "94.225.67.12" },
  { timestamp: "27/03 10:05:33", user: "Thomas Weber", role: "Comptable", action: "Export factures mars → téléchargé (PDF)", module: "Finances", ip: "81.246.12.90" },
  { timestamp: "26/03 17:45:20", user: "Pierre Collard", role: "Super Admin", action: "MAJ commission Valerco NV : 12% → 10% (Gold)", module: "Paramètres", ip: "81.246.12.45" },
  { timestamp: "26/03 16:30:08", user: "Sophie Martin", role: "Admin", action: "Import catalogue Pharmamed — 3200 lignes traitées", module: "Produits", ip: "91.182.34.78" },
];

const AdminLogs = () => {
  return (
    <div>
      <AdminTopBar title="Logs & Audit" subtitle="Journal d'activité de la plateforme" />

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#F8FAFC" }}>
              {["Timestamp", "Utilisateur", "Rôle", "Action", "Module", "IP"].map(h => (
                <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{l.timestamp}</TableCell>
                <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{l.user}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: roleColors[l.role].bg, color: roleColors[l.role].text, borderColor: "transparent" }}>
                    {l.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{l.action}</TableCell>
                <TableCell>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (moduleColors[l.module] || moduleColors.Paramètres).bg, color: (moduleColors[l.module] || moduleColors.Paramètres).text }}>
                    {l.module}
                  </span>
                </TableCell>
                <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{l.ip}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminLogs;
