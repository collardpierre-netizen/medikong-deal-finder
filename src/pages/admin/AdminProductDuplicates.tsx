import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, GitMerge, Loader2, Sparkles, AlertTriangle, Wand2 } from "lucide-react";

type DupGroup = {
  match_key: string;
  match_type: "gtin" | "cnk";
  variant_count: number;
  product_ids: string[];
  product_names: string[];
  gtins: (string | null)[];
  cnks: (string | null)[];
  offer_counts: number[];
  has_images: boolean[];
  is_active_flags: boolean[];
};

const sb = supabase as any;

const AdminProductDuplicates = () => {
  const qc = useQueryClient();
  const [autoOpen, setAutoOpen] = useState(false);
  const [pending, setPending] = useState<{ keep: string; drop: string; keepName: string; dropName: string } | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["product-duplicates"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("find_product_duplicates");
      if (error) throw error;
      return (data as DupGroup[]) || [];
    },
  });

  const mergeOne = useMutation({
    mutationFn: async ({ keep, drop }: { keep: string; drop: string }) => {
      const { data, error } = await sb.rpc("merge_products", { _keep: keep, _drop: drop });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (d) => {
      toast.success(`Fusion OK · ${d?.rows_reassigned ?? 0} lignes réassignées · ${d?.conflicts_deleted ?? 0} conflits nettoyés`);
      qc.invalidateQueries({ queryKey: ["product-duplicates"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur fusion"),
  });

  const autoMerge = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await sb.rpc("auto_merge_product_duplicates", { _dry_run: dryRun });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) toast.info(`Simulation : ${data?.groups_found ?? 0} groupes détectés`);
      else toast.success(`Fusion auto OK · ${data?.merges_executed ?? 0} fusions`);
      qc.invalidateQueries({ queryKey: ["product-duplicates"] });
      setAutoOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur fusion auto"),
  });

  const normalizeGtins = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("admin_normalize_product_gtins");
      if (error) throw error;
      return data as any;
    },
    onSuccess: (d) => {
      toast.success(`GTIN nettoyés · ${d?.renamed ?? 0} corrigés · ${d?.merged ?? 0} fusionnés`);
      qc.invalidateQueries({ queryKey: ["product-duplicates"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur normalisation GTIN"),
  });

  return (
    <div>
      <AdminTopBar
        title="Produits · Doublons détectés"
        subtitle="Détection par GTIN normalisé (suffixe .0 Excel retiré) ou code CNK identique"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/produits"><ArrowLeft size={14} className="mr-1" />Retour</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => normalizeGtins.mutate()} disabled={normalizeGtins.isPending}>
              {normalizeGtins.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Wand2 size={14} className="mr-1" />}
              Nettoyer GTIN Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => autoMerge.mutate(true)} disabled={autoMerge.isPending}>
              <Sparkles size={14} className="mr-1" />Simuler
            </Button>
            <Button size="sm" onClick={() => setAutoOpen(true)} className="bg-[#1E293B] hover:bg-[#1E293B]/90" disabled={groups.length === 0}>
              <GitMerge size={14} className="mr-1" />Fusion auto ({groups.length})
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">✨ Aucun doublon produit détecté.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Clé</TableHead>
                <TableHead>Variantes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const keepId = g.product_ids[0];
                const keepName = g.product_names[0];
                return (
                  <TableRow key={`${g.match_type}-${g.match_key}`}>
                    <TableCell className="align-top">
                      <div className="font-mono text-xs text-muted-foreground">{g.match_key}</div>
                      <Badge variant="secondary" className="mt-1 uppercase text-[10px]">{g.match_type}</Badge>
                      <Badge variant="outline" className="ml-1">{g.variant_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <ul className="space-y-1.5">
                        {g.product_names.map((name, i) => {
                          const isKeep = i === 0;
                          return (
                            <li key={g.product_ids[i]} className="flex items-center gap-2 text-sm">
                              {isKeep ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Canonique</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">Doublon</Badge>
                              )}
                              <span className={isKeep ? "font-semibold" : ""}>{name}</span>
                              <span className="text-xs text-muted-foreground">
                                · {g.offer_counts[i]} offres
                                {g.gtins[i] ? ` · ${g.gtins[i]}` : ""}
                                {g.cnks[i] ? ` · CNK ${g.cnks[i]}` : ""}
                                {!g.is_active_flags[i] ? " · inactif" : ""}
                              </span>
                              {!isKeep && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto h-7 text-xs"
                                  disabled={mergeOne.isPending}
                                  onClick={() =>
                                    setPending({ keep: keepId, drop: g.product_ids[i], keepName, dropName: name })
                                  }
                                >
                                  <GitMerge size={12} className="mr-1" />
                                  Fusionner → canonique
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} /> Confirmer la fusion produit
            </AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les données liées à <strong>{pending?.dropName}</strong> (offres, commandes, favoris, alertes, prix marché…)
              seront réassignées à <strong>{pending?.keepName}</strong>, et le doublon sera supprimé. Les conflits d'unicité sont nettoyés
              automatiquement. Action irréversible (journalisée dans l'audit).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) {
                  mergeOne.mutate({ keep: pending.keep, drop: pending.drop });
                  setPending(null);
                }
              }}
            >
              Fusionner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={autoOpen} onOpenChange={setAutoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} /> Fusion automatique de tous les doublons produits
            </AlertDialogTitle>
            <AlertDialogDescription>
              {groups.length} groupes seront fusionnés. Pour chaque groupe, le produit avec le plus d'offres (puis image, puis actif)
              est conservé, les autres sont supprimés avec réassignation des données liées. Continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => autoMerge.mutate(false)} disabled={autoMerge.isPending}>
              {autoMerge.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
              Lancer la fusion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProductDuplicates;
