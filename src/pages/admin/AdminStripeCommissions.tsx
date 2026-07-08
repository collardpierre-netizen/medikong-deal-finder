import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, CreditCard, Save, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/** Lien Stripe Dashboard pour un PaymentIntent (route dashboard identique en test/live). */
const stripePiUrl = (piId: string) => `https://dashboard.stripe.com/payments/${piId}`;


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

  // GO/NO-GO : lignes de commande avec un PaymentIntent Stripe (Connect, mandataire)
  const { data: recentPiLines = [], isLoading: loadingPi } = useQuery({
    queryKey: ["admin-order-lines-stripe-pi"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_lines")
        .select("id, order_id, vendor_id, line_total_incl_vat, stripe_payment_intent_id, created_at, orders:order_id(order_number, created_at), vendors:vendor_id(name, company_name)")
        .not("stripe_payment_intent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  // Agrège par (order_id, vendor_id, PI) pour une ligne par PaymentIntent
  const piRows = (() => {
    const map = new Map<string, { key: string; order_id: string; order_number: string; vendor_id: string; vendor_label: string; pi_id: string; total_ttc: number; created_at: string }>();
    for (const l of recentPiLines) {
      const pi = l.stripe_payment_intent_id as string;
      const key = `${l.order_id}::${l.vendor_id}::${pi}`;
      const cur = map.get(key);
      const amt = Number(l.line_total_incl_vat) || 0;
      if (cur) {
        cur.total_ttc += amt;
      } else {
        map.set(key, {
          key,
          order_id: l.order_id,
          order_number: l.orders?.order_number ?? l.order_id.slice(0, 8),
          vendor_id: l.vendor_id,
          vendor_label: l.vendors?.company_name || l.vendors?.name || l.vendor_id.slice(0, 8),
          pi_id: pi,
          total_ttc: amt,
          created_at: l.orders?.created_at || l.created_at,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  })();



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

      {/* GO/NO-GO — PaymentIntents Stripe Connect par commande / vendeur */}
      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h3 className="text-[15px] font-bold" style={{ color: "#1D2530" }}>PaymentIntents Stripe Connect (mandataire)</h3>
            <p className="text-[12px]" style={{ color: "#8B95A5" }}>1 PaymentIntent par vendeur et par commande — cliquez pour ouvrir dans le dashboard Stripe.</p>
          </div>
          <Badge variant="outline" className="text-[11px]">{piRows.length} PI</Badge>
        </div>
        <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          {loadingPi ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "#1B5BDA" }} />
            </div>
          ) : piRows.length === 0 ? (
            <div className="py-10 text-center text-[12px]" style={{ color: "#8B95A5" }}>
              Aucun PaymentIntent enregistré pour l'instant. Passez une commande de test pour valider le flux.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F8FAFC" }}>
                  {["Date", "Commande", "Vendeur", "Total TTC", "PaymentIntent", ""].map(h => (
                    <TableHead key={h} className="text-[11px] font-semibold" style={{ color: "#8B95A5" }}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {piRows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="text-[11px]" style={{ color: "#616B7C" }}>
                      {new Date(r.created_at).toLocaleDateString("fr-BE")}
                    </TableCell>
                    <TableCell className="text-[12px] font-mono font-semibold" style={{ color: "#1D2530" }}>
                      {r.order_number}
                    </TableCell>
                    <TableCell className="text-[12px]" style={{ color: "#1D2530" }}>
                      {r.vendor_label}
                    </TableCell>
                    <TableCell className="text-[12px] font-mono font-bold" style={{ color: "#059669" }}>
                      {r.total_ttc.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </TableCell>
                    <TableCell className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>
                      {r.pi_id}
                    </TableCell>
                    <TableCell>
                      <a
                        href={stripePiUrl(r.pi_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
                        style={{ color: "#1B5BDA" }}
                      >
                        Ouvrir dans Stripe <ExternalLink size={12} />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

