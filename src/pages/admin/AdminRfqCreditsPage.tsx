import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Coins, Sparkles, Loader2 } from "lucide-react";

interface BalanceRow {
  user_id: string;
  monthly_quota: number;
  monthly_used: number;
  permanent_credits: number;
  is_unlimited: boolean;
  rfq_unlimited_override: boolean;
  active_plan_id: string | null;
  plan_expires_at: string | null;
  total_consumed: number;
  total_purchased: number;
  full_name?: string | null;
  company_name?: string | null;
  email?: string | null;
}

export default function AdminRfqCreditsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<BalanceRow | null>(null);
  const [planCode, setPlanCode] = useState<string>("");
  const [extraCredits, setExtraCredits] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  // Liste des balances avec recherche profil
  const { data: balances, isLoading } = useQuery({
    queryKey: ["admin-rfq-balances", search],
    queryFn: async () => {
      let q = supabase
        .from("rfq_buyer_balances")
        .select(`
          user_id, monthly_quota, monthly_used, permanent_credits,
          is_unlimited, rfq_unlimited_override, active_plan_id, plan_expires_at,
          total_consumed, total_purchased,
          profiles!rfq_buyer_balances_user_id_fkey (full_name, company_name)
        `)
        .order("total_consumed", { ascending: false })
        .limit(100);
      const { data, error } = await q;
      if (error) {
        // Fallback sans join si la relation auto-détectée échoue
        const { data: bal } = await supabase
          .from("rfq_buyer_balances")
          .select("*")
          .order("total_consumed", { ascending: false })
          .limit(100);
        return (bal || []).map((b: any) => ({ ...b, full_name: null, company_name: null })) as BalanceRow[];
      }
      let rows = (data || []).map((b: any) => ({
        ...b,
        full_name: b.profiles?.full_name ?? null,
        company_name: b.profiles?.company_name ?? null,
      })) as BalanceRow[];
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        rows = rows.filter((r) =>
          (r.full_name || "").toLowerCase().includes(s) ||
          (r.company_name || "").toLowerCase().includes(s) ||
          r.user_id.toLowerCase().includes(s)
        );
      }
      return rows;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["admin-rfq-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("rfq_plans").select("code, label, plan_type").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Sélectionnez un utilisateur");
      const extra = extraCredits ? parseInt(extraCredits, 10) : 0;
      if (!planCode && !extra) throw new Error("Renseignez un plan ou un nombre de crédits");
      const { error } = await supabase.rpc("rfq_grant_credits", {
        _user_id: selectedUser.user_id,
        _plan_code: planCode || null,
        _extra_credits: extra,
        _reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Crédits attribués.");
      setPlanCode(""); setExtraCredits(""); setReason("");
      qc.invalidateQueries({ queryKey: ["admin-rfq-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleUnlimited = useMutation({
    mutationFn: async (row: BalanceRow) => {
      const next = !row.rfq_unlimited_override;
      const { error } = await supabase
        .from("rfq_buyer_balances")
        .update({ rfq_unlimited_override: next, is_unlimited: next || row.is_unlimited })
        .eq("user_id", row.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-rfq-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Crédits RFQ</h1>
        <p className="text-sm text-muted-foreground">Suivez le solde de chaque acheteur, attribuez manuellement un forfait ou des crédits.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Soldes acheteurs</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-9" placeholder="Nom, société, user_id…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Acheteur</th>
                <th className="text-right px-3 py-2">Quota mois</th>
                <th className="text-right px-3 py-2">Crédits</th>
                <th className="text-right px-3 py-2">Conso totale</th>
                <th className="text-right px-3 py-2">Achetés</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <tr><td colSpan={7} className="text-center py-6"><Loader2 className="inline h-4 w-4 animate-spin" /></td></tr>}
              {(balances || []).map((b) => (
                <tr key={b.user_id} className={selectedUser?.user_id === b.user_id ? "bg-primary/5" : "hover:bg-muted/30"}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{b.full_name || b.company_name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{b.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{Math.max(0, b.monthly_quota - b.monthly_used)} / {b.monthly_quota}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{b.permanent_credits}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.total_consumed}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.total_purchased}</td>
                  <td className="px-3 py-2">
                    {b.is_unlimited || b.rfq_unlimited_override ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Illimité</Badge>
                    ) : (
                      <Badge variant="outline">Standard</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedUser(b)}>Créditer</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleUnlimited.mutate(b)} disabled={toggleUnlimited.isPending}>
                      {b.rfq_unlimited_override ? "Retirer illimité" : "Passer illimité"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (balances || []).length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Aucun acheteur n'a encore de balance RFQ.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedUser && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4" /> Octroi pour {selectedUser.full_name || selectedUser.company_name || selectedUser.user_id.slice(0, 8)}
            </CardTitle>
            <CardDescription>Activer un plan/pack <em>ou</em> ajouter des crédits permanents (positif ou négatif).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan / Pack</Label>
                <Select value={planCode} onValueChange={setPlanCode}>
                  <SelectTrigger><SelectValue placeholder="(aucun)" /></SelectTrigger>
                  <SelectContent>
                    {(plans || []).map((p: any) => (
                      <SelectItem key={p.code} value={p.code}>{p.label} ({p.plan_type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Crédits supplémentaires (peut être négatif)</Label>
                <Input type="number" value={extraCredits} onChange={(e) => setExtraCredits(e.target.value)} placeholder="0" />
              </div>
              <div className="col-span-2">
                <Label>Motif</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : geste commercial, compensation litige…" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>Annuler</Button>
              <Button onClick={() => grant.mutate()} disabled={grant.isPending}>
                {grant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Sparkles className="h-4 w-4 mr-2" /> Appliquer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
