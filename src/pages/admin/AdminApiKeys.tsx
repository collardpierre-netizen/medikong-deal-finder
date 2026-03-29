import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Activity, Shield, Search, Book } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ALL_PERMISSIONS = [
  { value: "catalog:read", label: "Catalogue (lecture)", desc: "Lire produits, offres, catégories, marques" },
  { value: "catalog:write", label: "Catalogue (écriture)", desc: "Créer/modifier produits et offres" },
  { value: "orders:read", label: "Commandes (lecture)", desc: "Lire les commandes" },
  { value: "orders:write", label: "Commandes (écriture)", desc: "Créer des commandes via API" },
  { value: "customers:read", label: "Clients (lecture)", desc: "Lire les informations clients" },
  { value: "prices:read", label: "Prix (lecture)", desc: "Accéder aux prix et disponibilités" },
];

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "mk_live_";
  for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const AdminApiKeys = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "",
    permissions: ["catalog:read", "prices:read"] as string[],
    rate_limit_per_minute: 60,
    rate_limit_per_day: 10000,
  });

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["admin", "api_keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: requestLogs = [] } = useQuery({
    queryKey: ["admin", "api_request_logs_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_request_logs")
        .select("api_key_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const plainKey = generateApiKey();
      const hash = await sha256(plainKey);
      const prefix = plainKey.substring(0, 12);

      const { error } = await supabase.from("api_keys").insert({
        name: formData.name,
        key_hash: hash,
        key_prefix: prefix,
        permissions: formData.permissions,
        rate_limit_per_minute: formData.rate_limit_per_minute,
        rate_limit_per_day: formData.rate_limit_per_day,
      });
      if (error) throw error;
      return plainKey;
    },
    onSuccess: (plainKey) => {
      setNewKeyPlaintext(plainKey);
      qc.invalidateQueries({ queryKey: ["admin", "api_keys"] });
      toast.success("Clé API créée avec succès");
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("api_keys").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "api_keys"] });
      toast.success("Statut mis à jour");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "api_keys"] });
      toast.success("Clé supprimée");
    },
  });

  const activeKeys = apiKeys.filter(k => k.is_active).length;
  const totalRequests = requestLogs.length;
  const today = new Date().toISOString().split("T")[0];
  const todayRequests = requestLogs.filter(r => r.created_at.startsWith(today)).length;

  const filtered = apiKeys.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.key_prefix.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    createMutation.mutate(form);
  };

  const togglePermission = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <AdminTopBar title="Clés API" subtitle="Gérez les clés d'accès à l'API publique MediKong" />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard label="Clés actives" value={String(activeKeys)} icon={Key} />
        <KpiCard label="Total clés" value={String(apiKeys.length)} icon={Shield} />
        <KpiCard label="Requêtes aujourd'hui" value={String(todayRequests)} icon={Activity} />
        <KpiCard label="Requêtes (récentes)" value={String(totalRequests)} icon={Activity} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/api-docs")}>
            <Book className="w-4 h-4 mr-2" /> Documentation API
          </Button>
          <Button onClick={() => { setDialogOpen(true); setNewKeyPlaintext(null); setForm({ name: "", permissions: ["catalog:read", "prices:read"], rate_limit_per_minute: 60, rate_limit_per_day: 10000 }); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle clé
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Nom</th>
              <th className="text-left px-4 py-3 font-medium">Préfixe</th>
              <th className="text-left px-4 py-3 font-medium">Permissions</th>
              <th className="text-left px-4 py-3 font-medium">Limite/min</th>
              <th className="text-left px-4 py-3 font-medium">Limite/jour</th>
              <th className="text-left px-4 py-3 font-medium">Dernière utilisation</th>
              <th className="text-left px-4 py-3 font-medium">Statut</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(key => (
              <tr key={key.id} className="border-b hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{key.name}</td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{key.key_prefix}...</code>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {key.permissions.map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{key.rate_limit_per_minute}</td>
                <td className="px-4 py-3">{key.rate_limit_per_day.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString("fr-BE") : "Jamais"}
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={key.is_active}
                    onCheckedChange={v => toggleMutation.mutate({ id: key.id, is_active: v })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(key.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                {isLoading ? "Chargement..." : "Aucune clé API"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{newKeyPlaintext ? "Clé API créée !" : "Nouvelle clé API"}</DialogTitle>
          </DialogHeader>

          {newKeyPlaintext ? (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive mb-2">
                  ⚠️ Copiez cette clé maintenant — elle ne sera plus affichée.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{newKeyPlaintext}</code>
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(newKeyPlaintext); toast.success("Copié !"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setDialogOpen(false); setNewKeyPlaintext(null); }}>Fermer</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nom de la clé</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: ERP Pharmacie Centrale" />
              </div>

              <div>
                <Label className="mb-2 block">Permissions</Label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.value} className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={form.permissions.includes(p.value)}
                        onCheckedChange={() => togglePermission(p.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium">{p.label}</span>
                        <p className="text-xs text-muted-foreground">{p.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Limite / minute</Label>
                  <Input type="number" value={form.rate_limit_per_minute} onChange={e => setForm(f => ({ ...f, rate_limit_per_minute: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Limite / jour</Label>
                  <Input type="number" value={form.rate_limit_per_day} onChange={e => setForm(f => ({ ...f, rate_limit_per_day: Number(e.target.value) }))} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création..." : "Générer la clé"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminApiKeys;
