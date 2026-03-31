import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, CreditCard, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminStripeCommissions() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["admin-vendors-stripe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, slug, commission_rate, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, is_active, type")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("vendors")
        .update({ commission_rate: rate })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors-stripe"] });
      setEditingId(null);
      toast.success("Taux de commission mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <div>
      <AdminTopBar
        title="Commissions & Stripe Connect"
        subtitle="Gestion des taux de commission et statuts Stripe des vendeurs"
      />

      <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "#1B5BDA" }} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                {["Vendeur", "Type", "Commission", "Compte Stripe", "Paiements", "Virements", "Actions"].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>
                    {v.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]" style={{
                      backgroundColor: v.type === "qogita_virtual" ? "#EFF6FF" : "#F3F0FF",
                      color: v.type === "qogita_virtual" ? "#1B5BDA" : "#7C3AED",
                      borderColor: "transparent",
                    }}>
                      {v.type === "qogita_virtual" ? "Qogita" : "Réel"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingId === v.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0.05}
                          max={0.30}
                          step={0.01}
                          value={editRate}
                          onChange={(e) => setEditRate(parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-[12px] border rounded"
                          style={{ borderColor: "#E2E8F0" }}
                        />
                        <button
                          onClick={() => updateMutation.mutate({ id: v.id, rate: editRate })}
                          className="p-1 rounded"
                          style={{ color: "#059669" }}
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(v.id); setEditRate(Number(v.commission_rate)); }}
                        className="text-[12px] font-bold px-2 py-1 rounded hover:bg-gray-50"
                        style={{ color: "#1B5BDA" }}
                      >
                        {(Number(v.commission_rate) * 100).toFixed(0)}%
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    {v.stripe_account_id ? (
                      <Badge variant="outline" className="text-[10px]" style={{
                        backgroundColor: v.stripe_onboarding_complete ? "#ECFDF5" : "#FFFBEB",
                        color: v.stripe_onboarding_complete ? "#059669" : "#D97706",
                        borderColor: "transparent",
                      }}>
                        {v.stripe_onboarding_complete ? "Configuré" : "En cours"}
                      </Badge>
                    ) : (
                      <span className="text-[11px]" style={{ color: "#8B95A5" }}>—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {v.stripe_charges_enabled
                      ? <CheckCircle2 size={15} style={{ color: "#059669" }} className="mx-auto" />
                      : <XCircle size={15} style={{ color: "#CBD5E1" }} className="mx-auto" />
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    {v.stripe_payouts_enabled
                      ? <CheckCircle2 size={15} style={{ color: "#059669" }} className="mx-auto" />
                      : <XCircle size={15} style={{ color: "#CBD5E1" }} className="mx-auto" />
                    }
                  </TableCell>
                  <TableCell>
                    <CreditCard size={14} style={{ color: "#8B95A5" }} />
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
