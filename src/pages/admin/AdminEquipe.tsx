import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Shield, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const roleColors: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: "#FEF2F2", text: "#EF4343" },
  admin: { bg: "#EFF6FF", text: "#1B5BDA" },
  moderateur: { bg: "#F3F0FF", text: "#7C3AED" },
  support: { bg: "#ECFDF5", text: "#059669" },
  comptable: { bg: "#FFFBEB", text: "#D97706" },
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderateur: "Modérateur",
  support: "Support",
  comptable: "Comptable",
};

const modules = [
  "Dashboard", "Vendeurs", "Produits", "Commandes", "Litiges",
  "Finances", "Veille prix", "CRM", "CMS", "Logistique",
  "RBAC", "Paramètres", "Logs",
];

const roles = ["super_admin", "admin", "moderateur", "support", "comptable"];

const permissions: Record<string, Record<string, boolean>> = {
  super_admin: Object.fromEntries(modules.map(m => [m, true])),
  admin: Object.fromEntries(modules.map(m => [m, m !== "RBAC"])),
  moderateur: {
    Dashboard: true, Vendeurs: true, Produits: true, Commandes: true, Litiges: true,
    Finances: false, "Veille prix": true, CRM: false, CMS: true, Logistique: false,
    RBAC: false, Paramètres: false, Logs: false,
  },
  support: {
    Dashboard: true, Vendeurs: true, Produits: true, Commandes: true, Litiges: true,
    Finances: false, "Veille prix": false, CRM: true, CMS: false, Logistique: true,
    RBAC: false, Paramètres: false, Logs: false,
  },
  comptable: {
    Dashboard: true, Vendeurs: false, Produits: false, Commandes: true, Litiges: false,
    Finances: true, "Veille prix": false, CRM: false, CMS: false, Logistique: false,
    RBAC: false, Paramètres: false, Logs: true,
  },
};

const AdminEquipe = () => {
  const [tab, setTab] = useState("membres");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

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
            {isLoading ? <div className="py-12 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div> : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                    {["Membre", "Email", "Rôle", "Statut", "Dernière connexion"].map(h => (
                      <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const rc = roleColors[m.role] || roleColors.support;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: rc.text }}>
                              {m.name.split(" ").map(w => w[0]).join("")}
                            </div>
                            {m.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>{m.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold" style={{ backgroundColor: rc.bg, color: rc.text, borderColor: "transparent" }}>
                            {roleLabels[m.role] || m.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]" style={{
                            backgroundColor: m.is_active ? "#ECFDF5" : "#FEF2F2",
                            color: m.is_active ? "#059669" : "#EF4343",
                            borderColor: "transparent",
                          }}>
                            {m.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px]" style={{ color: "#8B95A5" }}>
                          {m.last_login ? new Date(m.last_login).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  <TableHead className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>Module</TableHead>
                  {roles.map(r => (
                    <TableHead key={r} className="text-[11px] font-semibold text-center" style={{ color: "#8B95A5" }}>{roleLabels[r]}</TableHead>
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
