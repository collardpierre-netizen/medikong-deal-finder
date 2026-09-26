import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Wholesaler = { wholesaler_profile_id: string; label: string; catalog_price: number | null; updated_at: string | null; stale: boolean };
type Summary = { wholesaler_profile_id: string; last_confirmed_at: string | null; unavailable_pharmacies: number };

const ddmm = (iso: string) => new Date(iso).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" });
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const eur = (v: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(v);

export function FieldReports({ productId, wholesalers }: { productId: string; wholesalers: Wholesaler[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["scan-field-summary", productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("scan_field_report_summary" as never, { _product_id: productId } as never);
      if (error) { console.error("scan_field_report_summary", error); return [] as Summary[]; }
      return (data ?? []) as unknown as Summary[];
    },
  });

  const submit = async (wid: string, kind: "confirm" | "unavailable" | "price") => {
    let cents: number | null = null;
    if (kind === "price") {
      const v = Number(price.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) { toast.error("Prix invalide"); return; }
      cents = Math.round(v * 100);
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("scan_submit_field_report" as never, {
      _product_id: productId, _wholesaler_profile_id: wid, _kind: kind, _price_excl_vat_cents: cents,
    } as never);
    setBusy(false);
    if (error) { console.error("scan_submit_field_report", error); toast.error("Signalement non enregistré"); return; }
    const res = data as unknown as { ok: boolean; reason?: string };
    if (!res?.ok && res?.reason === "already_reported_24h") { toast.info("Déjà signalé aujourd'hui pour ce grossiste"); return; }
    toast.success("Merci, signalement enregistré");
    setEditing(null); setPrice("");
    qc.invalidateQueries({ queryKey: ["scan-field-summary", productId] });
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3 text-sm">
      {wholesalers.map((w) => {
        const s = summary?.find((x) => x.wholesaler_profile_id === w.wholesaler_profile_id);
        return (
          <div key={w.wholesaler_profile_id} className="space-y-1.5">
            <div className={w.stale ? "text-muted-foreground" : ""}>
              {w.label}{w.catalog_price != null ? ` · ${eur(w.catalog_price)}` : ""}
              {w.updated_at ? ` · mis à jour le ${ddmm(w.updated_at)}` : ""}
            </div>
            {s && (s.last_confirmed_at || s.unavailable_pharmacies > 0) && (
              <div className="text-xs text-muted-foreground">
                {s.last_confirmed_at && `Confirmé il y a ${daysAgo(s.last_confirmed_at)} j`}
                {s.last_confirmed_at && s.unavailable_pharmacies > 0 && " · "}
                {s.unavailable_pharmacies > 0 && `Signalé indispo par ${s.unavailable_pharmacies} pharmacie${s.unavailable_pharmacies > 1 ? "s" : ""}`}
              </div>
            )}
            {editing === w.wholesaler_profile_id ? (
              <div className="flex gap-2">
                <Input inputMode="decimal" placeholder="Prix catalogue avant remise (HTVA)" value={price} onChange={(e) => setPrice(e.target.value)} />
                <Button size="sm" disabled={busy} onClick={() => submit(w.wholesaler_profile_id, "price")}>OK</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => submit(w.wholesaler_profile_id, "confirm")}><Check className="h-4 w-4" /> C'est bon</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => submit(w.wholesaler_profile_id, "unavailable")}><X className="h-4 w-4" /> Pas dispo</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(w.wholesaler_profile_id)}><Pencil className="h-4 w-4" /> Autre prix</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
