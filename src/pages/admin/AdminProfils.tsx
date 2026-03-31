import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings2, Eye, ArrowLeft } from "lucide-react";

const FEATURE_KEYS = [
  { key: "show_wholesale_price", label: "Afficher le prix grossiste" },
  { key: "show_pharmacist_price", label: "Afficher le prix pharmacien" },
  { key: "show_public_price", label: "Afficher le prix public" },
  { key: "show_tva", label: "Afficher le taux TVA" },
  { key: "show_supplier_name", label: "Afficher le nom du fournisseur" },
  { key: "show_qogita_offers", label: "Afficher les offres Qogita (Marketplace MediKong)" },
  { key: "show_external_offers", label: "Afficher les offres externes" },
  { key: "show_market_prices", label: "Afficher les prix du marché (veille)" },
  { key: "show_discount_tiers", label: "Afficher les paliers dégressifs" },
  { key: "show_mov", label: "Afficher le MOV" },
];

const DISPLAY_MODES = [
  { value: "market_price", label: "Prix du marché (veille)" },
  { value: "external_offer", label: "Offre externe (cliquable)" },
  { value: "hidden", label: "Masqué" },
];

export default function AdminProfils() {
  const qc = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [configTab, setConfigTab] = useState("visibility");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["admin-market-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_price_sources")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: visibility = [] } = useQuery({
    queryKey: ["admin-profile-visibility", selectedProfile?.id],
    enabled: !!selectedProfile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_visibility")
        .select("*")
        .eq("profile_id", selectedProfile.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: sourceConfigs = [] } = useQuery({
    queryKey: ["admin-source-profile-config", selectedProfile?.id],
    enabled: !!selectedProfile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_profile_config")
        .select("*")
        .eq("profile_id", selectedProfile.id);
      if (error) throw error;
      return data;
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ featureKey, visible }: { featureKey: string; visible: boolean }) => {
      const { error } = await supabase
        .from("profile_visibility")
        .upsert({
          profile_id: selectedProfile.id,
          feature_key: featureKey,
          is_visible: visible,
        }, { onConflict: "profile_id,feature_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-profile-visibility", selectedProfile?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateSourceConfig = useMutation({
    mutationFn: async ({ sourceId, mode, label }: { sourceId: string; mode: string; label?: string }) => {
      const { error } = await supabase
        .from("source_profile_config")
        .upsert({
          source_id: sourceId,
          profile_id: selectedProfile.id,
          display_mode: mode,
          display_label: label || null,
        }, { onConflict: "source_id,profile_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-source-profile-config", selectedProfile?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const getVisibility = (key: string) => {
    const found = visibility.find((v: any) => v.feature_key === key);
    return found ? found.is_visible : true; // default visible
  };

  const getSourceConfig = (sourceId: string) => {
    return sourceConfigs.find((sc: any) => sc.source_id === sourceId);
  };

  if (selectedProfile) {
    return (
      <div>
        <AdminTopBar title={`Profil : ${selectedProfile.name}`} subtitle="Configuration de la visibilité et des sources" />
        <Button variant="outline" size="sm" className="mb-4 gap-1.5" onClick={() => setSelectedProfile(null)}>
          <ArrowLeft size={14} /> Retour aux profils
        </Button>

        <Tabs value={configTab} onValueChange={setConfigTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="visibility" className="text-xs gap-1"><Eye size={14} /> Visibilité données</TabsTrigger>
            <TabsTrigger value="sources" className="text-xs gap-1"><Settings2 size={14} /> Sources & Affichage</TabsTrigger>
          </TabsList>

          <TabsContent value="visibility">
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Donnée</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground w-24 text-center">Visible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURE_KEYS.map((fk) => (
                    <TableRow key={fk.key}>
                      <TableCell className="text-[13px]">{fk.label}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={getVisibility(fk.key)}
                          onCheckedChange={(checked) => toggleVisibility.mutate({ featureKey: fk.key, visible: checked })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="sources">
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Source</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Mode d'affichage</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground">Label personnalisé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((src: any) => {
                    const config = getSourceConfig(src.id);
                    return (
                      <TableRow key={src.id}>
                        <TableCell className="text-[13px] font-medium">{src.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{src.source_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={config?.display_mode || "hidden"}
                            onValueChange={(mode) => updateSourceConfig.mutate({ sourceId: src.id, mode, label: config?.display_label })}
                          >
                            <SelectTrigger className="w-[220px] text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DISPLAY_MODES.map((dm) => (
                                <SelectItem key={dm.value} value={dm.value}>{dm.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-xs w-[200px]"
                            placeholder="Ex: Prix public Medi-Market"
                            defaultValue={config?.display_label || ""}
                            onBlur={(e) => {
                              const label = e.target.value.trim();
                              if (label !== (config?.display_label || "")) {
                                updateSourceConfig.mutate({ sourceId: src.id, mode: config?.display_mode || "hidden", label });
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div>
      <AdminTopBar title="Profils utilisateurs" subtitle="Configurez la visibilité des données et des sources par profil professionnel" />

      <div className="bg-white rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] font-semibold text-muted-foreground">Profil</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground">Slug</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground">Description</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground w-20 text-center">Ordre</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground w-20 text-center">Statut</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-[13px] font-semibold">{p.name}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground font-mono">{p.slug}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{p.description || "—"}</TableCell>
                  <TableCell className="text-center text-[12px]">{p.display_order}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                      {p.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setSelectedProfile(p); setConfigTab("visibility"); }}>
                      <Settings2 size={14} /> Configurer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
