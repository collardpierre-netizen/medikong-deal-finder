import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Landmark, CheckCircle2, Loader2, Trash2 } from "lucide-react";

type TransferState = "pending" | "received" | "settled";

interface TransferRow {
  id: string;
  order_id: string;
  value_date: string | null;
  amount_cents: number;
  state: TransferState;
  bank_reference: string | null;
  note: string | null;
  confirmed_at: string | null;
  created_at: string;
}

const STATE_LABELS: Record<TransferState, string> = {
  pending: "En cours",
  received: "Reçu",
  settled: "Encaissé",
};

const STATE_CLASSES: Record<TransferState, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  received: "bg-blue-100 text-blue-800 border-blue-200",
  settled: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const fmtEur = (cents: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(cents / 100);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

interface Props {
  orderId: string;
  /** Total TTC de la commande, en euros. */
  orderTotalInclVat?: number;
}

const OrderBankTransfersPanel = ({ orderId, orderTotalInclVat = 0 }: Props) => {
  const queryClient = useQueryClient();
  const queryKey = ["order-bank-transfers", orderId];

  const [valueDate, setValueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<TransferState>("received");

  const { data: transfers = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_bank_transfers")
        .select("id, order_id, value_date, amount_cents, state, bank_reference, note, confirmed_at, created_at")
        .eq("order_id", orderId)
        .order("value_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TransferRow[];
    },
    enabled: !!orderId,
  });

  const settledCents = useMemo(
    () => transfers.filter((t) => t.state === "settled").reduce((s, t) => s + t.amount_cents, 0),
    [transfers],
  );
  const totalCents = Math.round((orderTotalInclVat || 0) * 100);
  const deltaCents = settledCents - totalCents;

  const addTransfer = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(String(amount).replace(",", ".")) * 100);
      if (!Number.isFinite(cents) || cents <= 0) throw new Error("Montant invalide");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("order_bank_transfers").insert({
        order_id: orderId,
        value_date: valueDate || null,
        amount_cents: cents,
        state,
        bank_reference: reference.trim() || null,
        note: note.trim() || null,
        created_by: auth?.user?.id ?? null,
        confirmed_by: state === "settled" ? auth?.user?.id ?? null : null,
        confirmed_at: state === "settled" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Virement enregistré");
      setAmount("");
      setReference("");
      setNote("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Enregistrement impossible"),
  });

  const updateState = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: TransferState }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("order_bank_transfers")
        .update({
          state: next,
          confirmed_by: next === "settled" ? auth?.user?.id ?? null : null,
          confirmed_at: next === "settled" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.next === "settled" ? "Encaissement confirmé" : "État mis à jour");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Mise à jour impossible"),
  });

  const removeTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_bank_transfers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ligne supprimée");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Suppression impossible"),
  });

  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#E2E8F0" }}>
        <Landmark className="h-4 w-4 text-mk-blue" />
        <h3 className="font-semibold text-mk-navy">Virements reçus</h3>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun virement enregistré pour cette commande.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Date de valeur</th>
                  <th className="py-2 pr-3 text-right">Montant</th>
                  <th className="py-2 pr-3">État</th>
                  <th className="py-2 pr-3">Référence</th>
                  <th className="py-2 pr-3">Commentaire</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t" style={{ borderColor: "#EEF2F7" }}>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(t.value_date)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmtEur(t.amount_cents)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={STATE_CLASSES[t.state]}>
                        {STATE_LABELS[t.state]}
                      </Badge>
                      {t.state === "settled" && t.confirmed_at && (
                        <div className="text-[11px] text-muted-foreground mt-1">le {fmtDate(t.confirmed_at)}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{t.bank_reference || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{t.note || "—"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {t.state !== "settled" && (
                        <Button
                          size="sm"
                          onClick={() => updateState.mutate({ id: t.id, next: "settled" })}
                          disabled={updateState.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Confirmer l'encaissement
                        </Button>
                      )}
                      {t.state === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          onClick={() => updateState.mutate({ id: t.id, next: "received" })}
                          disabled={updateState.isPending}
                        >
                          Marquer reçu
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2 text-destructive"
                        onClick={() => removeTransfer.mutate(t.id)}
                        disabled={removeTransfer.isPending}
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-md bg-slate-50 border px-3 py-2 text-sm" style={{ borderColor: "#E2E8F0" }}>
          <span className="text-muted-foreground">Total encaissé : </span>
          <span className="font-mono font-semibold">{fmtEur(settledCents)}</span>
          <span className="text-muted-foreground"> / {fmtEur(totalCents)} TTC</span>
          {totalCents > 0 && deltaCents !== 0 && (
            <span className={deltaCents < 0 ? "ml-2 text-amber-700" : "ml-2 text-blue-700"}>
              {deltaCents < 0 ? `Reste ${fmtEur(-deltaCents)}` : `Trop-perçu ${fmtEur(deltaCents)}`}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div>
            <Label htmlFor="obt-date" className="text-xs">Date de valeur</Label>
            <Input id="obt-date" type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="obt-amount" className="text-xs">Montant (€)</Label>
            <Input
              id="obt-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">État</Label>
            <Select value={state} onValueChange={(v) => setState(v as TransferState)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En cours</SelectItem>
                <SelectItem value="received">Reçu</SelectItem>
                <SelectItem value="settled">Encaissé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="obt-ref" className="text-xs">Référence bancaire</Label>
            <Input id="obt-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Communication" />
          </div>
          <div>
            <Label htmlFor="obt-note" className="text-xs">Commentaire</Label>
            <Input id="obt-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="md:col-span-5">
            <Button onClick={() => addTransfer.mutate()} disabled={addTransfer.isPending || !amount}>
              {addTransfer.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer le virement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBankTransfersPanel;
