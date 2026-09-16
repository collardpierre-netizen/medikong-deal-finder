import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MEDIKONG_BENEFICIARY, MEDIKONG_IBAN } from "@/lib/epc-qr";
import { formatUpdatedAt } from "@/lib/format-date";

type VendorRow = {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  mandate_signed_at: string | null;
  self_billing_enabled: boolean | null;
};

export default function AdminSelfBilling() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyMissingMandate, setOnlyMissingMandate] = useState(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["admin-self-billing-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, email, mandate_signed_at, self_billing_enabled")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as VendorRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ vendor, enabled }: { vendor: VendorRow; enabled: boolean }) => {
      const { error } = await supabase
        .from("vendors")
        .update({ self_billing_enabled: enabled })
        .eq("id", vendor.id);
      if (error) throw error;
      const label = vendor.company_name || vendor.name || vendor.id;
      // Trace obligatoire : l'activation conditionne l'émission de factures au nom du fournisseur.
      const { error: auditErr } = await supabase.from("audit_logs").insert({
        action: enabled ? "self_billing_enabled" : "self_billing_disabled",
        module: "invoicing",
        detail: `Facturation au nom et pour le compte de ${label} ${enabled ? "activée" : "désactivée"}.`,
      });
      if (auditErr) console.error("[self-billing] audit_logs insert failed", auditErr);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-self-billing-vendors"] });
      toast.success(vars.enabled ? "Facturation activée" : "Facturation désactivée");
    },
    onError: (e: any) => toast.error("Modification impossible", { description: e?.message }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (vendors || []).filter((v) => {
      if (onlyMissingMandate && v.mandate_signed_at) return false;
      if (!q) return true;
      return `${v.company_name ?? ""} ${v.name ?? ""} ${v.email ?? ""}`.toLowerCase().includes(q);
    });
  }, [vendors, search, onlyMissingMandate]);

  const missingCount = (vendors || []).filter((v) => !v.mandate_signed_at).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturation au nom et pour le compte</h1>
        <p className="text-sm text-muted-foreground">
          Les commandes payées par virement sont encaissées par MediKong, qui facture au nom et pour le compte du
          fournisseur puis le reverse, commission déduite. Activez ou suspendez ce mode fournisseur par fournisseur.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compte de paiement utilisé sur les factures</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Bénéficiaire</span>
            <div className="font-medium">{MEDIKONG_BENEFICIARY}</div>
          </div>
          <div>
            <span className="text-muted-foreground">IBAN</span>
            <div className="font-mono">{MEDIKONG_IBAN}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Rechercher un fournisseur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="only-missing"
            checked={onlyMissingMandate}
            onCheckedChange={setOnlyMissingMandate}
          />
          <Label htmlFor="only-missing" className="text-sm">
            Mandat manquant uniquement ({missingCount})
          </Label>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Mandat de facturation</TableHead>
                <TableHead className="text-right">Facturation activée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Aucun fournisseur.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((v) => {
                const hasMandate = !!v.mandate_signed_at;
                const enabled = v.self_billing_enabled !== false;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-medium">{v.company_name || v.name || v.id}</div>
                      {v.email && <div className="text-xs text-muted-foreground">{v.email}</div>}
                    </TableCell>
                    <TableCell>
                      {hasMandate ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Signé le {formatUpdatedAt(v.mandate_signed_at as string)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          Manquant
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {!hasMandate && enabled && (
                          <span className="text-xs text-muted-foreground">
                            Sans effet tant que le mandat n'est pas signé
                          </span>
                        )}
                        <Switch
                          checked={enabled}
                          disabled={toggle.isPending}
                          onCheckedChange={(next) => toggle.mutate({ vendor: v, enabled: next })}
                          aria-label="Activer la facturation au nom et pour le compte"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Fournisseur désactivé : aucune facture n'est émise en son nom lors de l'encaissement, et la raison est
        journalisée. Les factures déjà émises ne sont jamais modifiées.
      </p>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin-self-billing-vendors"] })}>
          Rafraîchir
        </Button>
      </div>
    </div>
  );
}
