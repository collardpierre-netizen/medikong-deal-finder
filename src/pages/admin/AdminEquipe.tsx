import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Shield, Users } from "lucide-react";

const members = [
  { name: "Pierre Collard", email: "pierre@medikong.pro", role: "Super Admin", status: "active", lastLogin: "27/03 14:30" },
  { name: "Sophie Martin", email: "sophie@medikong.pro", role: "Admin", status: "active", lastLogin: "27/03 13:15" },
  { name: "Marc Dubois", email: "marc@medikong.pro", role: "Modérateur", status: "active", lastLogin: "27/03 11:45" },
  { name: "Julie Petit", email: "julie@medikong.pro", role: "Support", status: "active", lastLogin: "27/03 10:20" },
  { name: "Thomas Weber", email: "thomas@medikong.pro", role: "Comptable", status: "active", lastLogin: "26/03 17:00" },
];

const roleColors: Record<string, { bg: string; text: string }> = {
  "Super Admin": { bg: "#FEF2F2", text: "#EF4343" },
  "Admin": { bg: "#EFF6FF", text: "#1B5BDA" },
  "Modérateur": { bg: "#F3F0FF", text: "#7C3AED" },
  "Support": { bg: "#ECFDF5", text: "#059669" },
  "Comptable": { bg: "#FFFBEB", text: "#D97706" },
};

const modules = [
  "Dashboard", "Vendeurs", "Produits", "Commandes", "Litiges",
  "Finances", "Veille prix", "CRM", "CMS", "Logistique",
  "RBAC", "Paramètres", "Logs",
];

const roles = ["Super Admin", "Admin", "Modérateur", "Support", "Comptable"];

const permissions: Record<string, Record<string, boolean>> = {
  "Super Admin": Object.fromEntries(modules.map(m => [m, true])),
  "Admin": Object.fromEntries(modules.map(m => [m, m !== "RBAC"])),
  "Modérateur": {
    Dashboard: true, Vendeurs: true, Produits: true, Commandes: true, Litiges: true,
    Finances: false, "Veille prix": true, CRM: false, CMS: true, Logistique: false,
    RBAC: false, Paramètres: false, Logs: false,
  },
  "Support": {
    Dashboard: true, Vendeurs: true, Produits: true, Commandes: true, Litiges: true,
    Finances: false, "Veille prix": false, CRM: true, CMS: false, Logistique: true,
    RBAC: false, Paramètres: false, Logs: false,
  },
  "Comptable": {
    Dashboard: true, Vendeurs: false, Produits: false, Commandes: true, Litiges: false,
    Finances: true, "Veille prix": false, CRM: false, CMS: false, Logistique: false,
    RBAC: false, Paramètres: false, Logs: true,
  },
};

const AdminEquipe = () => {
  const [tab, setTab] = useState("membres");

  return (
    <div>
      <AdminTopBar title="Équipe & Rôles" subtitle="Gestion des accès et permissions RBAC" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4" style={{ backgroundColor: "#E2E8F0" }}>
          <TabsTrigger value="membres" className="text-[13px]">Membres</TabsTrigger>
          <TabsTrigger value="permissions" className="text-[13px]">Matrice permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="membres">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Membre", "Email", "Rôle", "Statut", "Dernière connexion"].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.email}>
                    <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: roleColors[m.role].text }}>
                          {m.name.split(" ").map(w => w[0]).join("")}
                        </div>
                        {m.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{m.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: roleColors[m.role].bg, color: roleColors[m.role].text, borderColor: "transparent" }}>
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#ECFDF5", color: "#059669", borderColor: "transparent" }}>Actif</Badge>
                    </TableCell>
                    <TableCell className="text-[11px]" style={{ color: "#8B95A5" }}>{m.lastLogin}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Module</TableHead>
                  {roles.map(r => (
                    <TableHead key={r} className="text-[11px] font-semibold text-center" style={{ color: "#8B95A5" }}>{r}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod) => (
                  <TableRow key={mod}>
                    <TableCell className="text-[12px] font-medium" style={{ color: "#1D2530" }}>{mod}</TableCell>
                    {roles.map(r => (
                      <TableCell key={r} className="text-center">
                        {permissions[r][mod]
                          ? <CheckCircle2 size={15} style={{ color: "#059669" }} className="mx-auto" />
                          : <XCircle size={15} style={{ color: "#CBD5E1" }} className="mx-auto" />
                        }
                      </TableCell>
                    ))}
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

export default AdminEquipe;
