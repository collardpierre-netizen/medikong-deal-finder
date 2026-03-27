import AdminTopBar from "@/components/admin/AdminTopBar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuditLogs } from "@/hooks/useAdminData";

const roleColors: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: "#FEF2F2", text: "#EF4343" },
  admin: { bg: "#EFF6FF", text: "#1B5BDA" },
  moderateur: { bg: "#F3F0FF", text: "#7C3AED" },
  support: { bg: "#ECFDF5", text: "#059669" },
  comptable: { bg: "#FFFBEB", text: "#D97706" },
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

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderateur: "Modérateur",
  support: "Support",
  comptable: "Comptable",
};

const AdminLogs = () => {
  const { data: logs = [], isLoading } = useAuditLogs();

  return (
    <div>
      <AdminTopBar title="Logs & Audit" subtitle="Journal d'activité de la plateforme" />

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                {["Timestamp", "Utilisateur", "Rôle", "Action", "Module", "IP"].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => {
                const role = l.user_role || "support";
                const rc = roleColors[role] || roleColors.support;
                const mc = moduleColors[l.module || ""] || moduleColors.Paramètres;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>
                      {new Date(l.created_at).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{l.user_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: rc.bg, color: rc.text, borderColor: "transparent" }}>
                        {roleLabels[role] || role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#616B7C" }}>{l.detail || l.action}</TableCell>
                    <TableCell>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: mc.bg, color: mc.text }}>
                        {l.module || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>{l.ip_address || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
