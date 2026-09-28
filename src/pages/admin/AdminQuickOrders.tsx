import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Zap } from "lucide-react";

interface Row {
  id: string;
  reference: string;
  created_at: string;
  status: string;
  language: string;
  pharmacy_name: string | null;
  contact_email: string | null;
  city: string | null;
  subtotal_ht_cents: number;
  shipping_ht_cents: number;
  vat_cents: number;
  total_ttc_cents: number;
  franco_reached: boolean;
  requested_delivery_date: string | null;
  vat_rates: number[];
  line_count: number;
}

const eur = (c: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format((c || 0) / 100);
const dt = (d: string) =>
  new Date(d).toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const rate = (r: number) => `${Number(r).toLocaleString("fr-BE")} %`;

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const AdminQuickOrders = () => {
  const [lang, setLang] = useState<string>("all");
  const [vat, setVat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-quick-orders", lang, vat],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_quick_orders" as never, {
        p_language: lang === "all" ? null : lang,
        p_vat_rate: vat === "all" ? null : Number(vat),
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [r.reference, r.pharmacy_name, r.contact_email, r.city].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const totals = useMemo(
    () => rows.reduce((a, r) => ({ ht: a.ht + r.subtotal_ht_cents + r.shipping_ht_cents, ttc: a.ttc + r.total_ttc_cents }), { ht: 0, ttc: 0 }),
    [rows],
  );

  const exportCsv = () => {
    const header = ["Référence", "Date", "Statut", "Langue", "Pharmacie", "E-mail", "Ville", "Taux TVA", "Lignes",
      "Sous-total HT", "Port HT", "TVA", "Total TTC", "Franco", "Livraison souhaitée"];
    const lines = rows.map((r) => [
      r.reference, r.created_at, r.status, r.language.toUpperCase(), r.pharmacy_name, r.contact_email, r.city,
      r.vat_rates.map((x) => `${x}%`).join(" / "), r.line_count,
      (r.subtotal_ht_cents / 100).toFixed(2).replace(".", ","), (r.shipping_ht_cents / 100).toFixed(2).replace(".", ","),
      (r.vat_cents / 100).toFixed(2).replace(".", ","), (r.total_ttc_cents / 100).toFixed(2).replace(".", ","),
      r.franco_reached ? "oui" : "non", r.requested_delivery_date,
    ].map(csvCell).join(";"));
    const blob = new Blob(["\ufeff" + [header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commandes-quick-order-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Commandes rapides (quick-order)</h1>
        </div>
        <Button onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> Exporter CSV ({rows.length})
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les langues</SelectItem>
            <SelectItem value="fr">Français (FR)</SelectItem>
            <SelectItem value="nl">Néerlandais (NL)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vat} onValueChange={setVat}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les taux TVA</SelectItem>
            <SelectItem value="6">Contient 6 %</SelectItem>
            <SelectItem value="21">Contient 21 %</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-72" placeholder="Référence, pharmacie, e-mail, ville…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ml-auto text-sm text-muted-foreground self-center">
          HT {eur(totals.ht)} · TTC {eur(totals.ttc)}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <p className="text-destructive">Erreur : {(error as Error).message}</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Référence</th><th className="p-3">Date</th><th className="p-3">Pharmacie</th>
                <th className="p-3">Langue</th><th className="p-3">TVA</th><th className="p-3">Statut</th>
                <th className="p-3 text-right">HT</th><th className="p-3 text-right">TVA</th><th className="p-3 text-right">TTC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-mono">{r.reference}</td>
                  <td className="p-3 whitespace-nowrap">{dt(r.created_at)}</td>
                  <td className="p-3">
                    <div>{r.pharmacy_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{[r.city, r.contact_email].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="p-3"><Badge variant="outline">{r.language.toUpperCase()}</Badge></td>
                  <td className="p-3 space-x-1">{r.vat_rates.map((x) => <Badge key={x} variant="secondary">{rate(x)}</Badge>)}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3 text-right">{eur(r.subtotal_ht_cents + r.shipping_ht_cents)}</td>
                  <td className="p-3 text-right">{eur(r.vat_cents)}</td>
                  <td className="p-3 text-right font-medium">{eur(r.total_ttc_cents)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucune commande.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminQuickOrders;
