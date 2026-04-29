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
import { ArrowLeft, GitMerge, Loader2, Sparkles, AlertTriangle } from "lucide-react";

type DuplicateGroup = {
  norm_key: string;
  variant_count: number;
  brand_ids: string[];
  brand_names: string[];
  product_counts: number[];
};

const AdminBrandDuplicates = () => {
  const qc = useQueryClient();
  const [autoOpen, setAutoOpen] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<{ keep: string; drop: string; keepName: string; dropName: string } | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["brand-duplicates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_brand_duplicates");
      if (error) throw error;
      return (data as DuplicateGroup[]) || [];
    },
  });

  const mergeOne = useMutation({
    mutationFn: async ({ keep, drop }: { keep: string; drop: string }) => {
      const { data, error } = await supabase.rpc("merge_brands", { _keep: keep, _drop: drop });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`Fusion OK · ${data?.products_reassigned ?? 0} produits réassignés`);
      qc.invalidateQueries({ queryKey: ["brand-duplicates"] });
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur fusion"),
  });

  const autoMerge = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.rpc("auto_merge_brand_duplicates", { _dry_run: dryRun });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) {
        toast.info(`Simulation : ${data?.groups_found ?? 0} groupes détectés`);
      } else {
        toast.success(
          `Fusion auto OK · ${data?.merges_executed ?? 0} fusions · ${data?.products_reassigned ?? 0} produits réassignés`,
        );
      }
      qc.invalidateQueries({ queryKey: ["brand-duplicates"] });
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      setAutoOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erreur fusion auto"),
  });

  return (
    <div>
      <AdminTopBar
        title="Marques · Doublons détectés"
        subtitle="Normalisation : minuscules, sans accents/espaces, sans suffixes .com/.be/.fr"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/marques"><ArrowLeft size={14} className="mr-1" />Retour</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => autoMerge.mutate(true)}
              disabled={autoMerge.isPending}
            >
              {autoMerge.isPending && autoMerge.variables === true ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Sparkles size={14} className="mr-1" />
              )}
              Simuler
            </Button>
            <Button
              size="sm"
              onClick={() => setAutoOpen(true)}
              className="bg-[#1E293B] hover:bg-[#1E293B]/90"
              disabled={groups.length === 0}
            >
              <GitMerge size={14} className="mr-1" />
              Fusion auto ({groups.length})
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            ✨ Aucun doublon détecté. Le catalogue marques est propre.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clé normalisée</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead className="w-[140px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const keepId = g.brand_ids[0];
                const keepName = g.brand_names[0];
                return (
                  <TableRow key={g.norm_key}>
                    <TableCell className="font-mono text-xs text-muted-foreground align-top">
                      {g.norm_key}
                      <Badge variant="secondary" className="ml-2">{g.variant_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <ul className="space-y-1.5">
                        {g.brand_names.map((name, i) => {
                          const isKeep = i === 0;
                          return (
                            <li key={g.brand_ids[i]} className="flex items-center gap-2 text-sm">
                              {isKeep ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                  Canonique
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">Doublon</Badge>
                              )}
                              <span className={isKeep ? "font-semibold" : ""}>{name}</span>
                              <span className="text-xs text-muted-foreground">
                                · {g.product_counts[i]} produits
                              </span>
                              {!isKeep && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto h-7 text-xs"
                                  onClick={() =>
                                    setPendingMerge({
                                      keep: keepId,
                                      drop: g.brand_ids[i],
                                      keepName,
                                      dropName: name,
                                    })
                                  }
                                  disabled={mergeOne.isPending}
                                >
                                  <GitMerge size={12} className="mr-1" />
                                  Fusionner → {keepName}
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!pendingMerge} onOpenChange={(o) => !o && setPendingMerge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} /> Confirmer la fusion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tous les produits liés à <strong>{pendingMerge?.dropName}</strong> seront réassignés à{" "}
              <strong>{pendingMerge?.keepName}</strong>, et la marque doublon sera supprimée. Action irréversible (mais journalisée).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMerge) {
                  mergeOne.mutate({ keep: pendingMerge.keep, drop: pendingMerge.drop });
                  setPendingMerge(null);
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
              <AlertTriangle className="text-amber-500" size={18} /> Fusion automatique de tous les doublons
            </AlertDialogTitle>
            <AlertDialogDescription>
              {groups.length} groupes seront fusionnés. Pour chacun, la marque avec le plus de produits est conservée et les
              autres sont supprimées (produits réassignés). Toutes les opérations sont tracées dans l'audit. Continuer ?
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

export default AdminBrandDuplicates;
