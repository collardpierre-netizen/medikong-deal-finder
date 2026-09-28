/** Tableau de bord « Scan — usage » (lecture seule, comptes de test exclus). */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sb = supabase as any;
const DAY = 86_400_000;
const fr = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

async function all(q: any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export default function AdminScanUsage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-scan-usage"],
    queryFn: async () => {
      const customers = (await all(() => sb.from("customers").select("id, company_name, is_test, scan_enabled").eq("scan_enabled", true).order("company_name")))
        .filter((c: any) => !c.is_test);
      const ids = customers.map((c: any) => c.id);
      if (!ids.length) return { rows: [], funnel: null, notFound: { n: 0, pharmacies: 0 }, completePct: null, requests: [] };
      const [events, invites, conds, carts, reqs] = await Promise.all([
        all(() => sb.from("scan_events").select("customer_id, scanned_at, match_status, verdict, result").in("customer_id", ids)),
        all(() => sb.from("audit_logs").select("entity_id, created_at").eq("action", "scan_invitation_sent").in("entity_id", ids)),
        all(() => sb.from("pharmacist_wholesaler_settings").select("customer_id").in("customer_id", ids)),
        all(() => sb.from("scan_cart_attributions").select("customer_id, order_line_id").in("customer_id", ids)),
        all(() => sb.from("sourcing_requests").select("id, request_number, customer_id, product_description, status, created_at").eq("source", "scan_price_request").in("customer_id", ids)),
      ]);
      const now = Date.now();
      const rows = customers.map((c: any) => {
        const ev = events.filter((e: any) => e.customer_id === c.id).map((e: any) => +new Date(e.scanned_at)).sort((a, b) => a - b);
        const inv = invites.filter((i: any) => i.entity_id === c.id).map((i: any) => i.created_at).sort();
        const cart = carts.filter((x: any) => x.customer_id === c.id);
        return {
          id: c.id, name: c.company_name ?? "—", invited: inv[0] ?? null,
          first: ev[0] ? new Date(ev[0]).toISOString() : null,
          s7: ev.filter((t) => now - t < 7 * DAY).length, s30: ev.filter((t) => now - t < 30 * DAY).length,
          total: ev.length, last: ev.length ? new Date(ev[ev.length - 1]).toISOString() : null,
          conditions: conds.some((x: any) => x.customer_id === c.id),
          cart: cart.length, orders: cart.filter((x: any) => x.order_line_id).length,
        };
      });
      const funnel = {
        invited: rows.length,
        connected: rows.filter((r) => r.total > 0 || r.conditions).length,
        first: rows.filter((r) => r.total >= 1).length,
        ten: rows.filter((r) => r.total >= 10).length,
        order: rows.filter((r) => r.orders > 0).length,
      };
      const nf = events.filter((e: any) => e.match_status === "not_found" && now - +new Date(e.scanned_at) < 7 * DAY);
      const matched = events.filter((e: any) => e.match_status === "matched");
      const complete = matched.filter((e: any) => e.verdict && e.verdict !== "none" && /"margin":\{/.test(e.result ?? ""));
      return {
        rows, funnel,
        notFound: { n: nf.length, pharmacies: new Set(nf.map((e: any) => e.customer_id)).size },
        completePct: events.length ? Math.round((complete.length / events.length) * 100) : null,
        requests: reqs.filter((r: any) => !["done", "closed", "cancelled", "rejected", "fulfilled"].includes(r.status))
          .map((r: any) => ({ ...r, name: customers.find((c: any) => c.id === r.customer_id)?.company_name ?? "—", age: Math.floor((now - +new Date(r.created_at)) / DAY) }))
          .sort((a: any, b: any) => b.age - a.age),
      };
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">Lecture impossible : {(error as any)?.message}</div>;
  const f = data.funnel;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan — usage</h1>
        <p className="text-sm text-muted-foreground">Officines avec l'accès Scan, comptes de test exclus.</p>
      </div>
      {f && (
        <div className="grid gap-3 md:grid-cols-5">
          {[["Invitées", f.invited], ["Connectées", f.connected], ["1er scan", f.first], ["10 scans", f.ten], ["1re commande", f.order]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{v as number}</div><div className="text-sm text-muted-foreground">{l}</div></div>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{data.notFound.n}</div><div className="text-sm text-muted-foreground">Codes non reconnus sur 7 j · {data.notFound.pharmacies} officine(s)</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{data.completePct == null ? "—" : `${data.completePct} %`}</div><div className="text-sm text-muted-foreground">Scans avec verdict complet (prix + marge)</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-2xl font-bold">{data.requests.length}</div><div className="text-sm text-muted-foreground">Demandes « Demander ce prix » ouvertes</div></div>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            {["Officine", "Invitée le", "1er scan", "Scans 7 j", "Scans 30 j", "Dernière activité", "Conditions", "Au panier", "Commandes"].map((h) => <TableHead key={h}>{h}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {data.rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell><TableCell>{fr(r.invited)}</TableCell><TableCell>{fr(r.first)}</TableCell>
                <TableCell>{r.s7}</TableCell><TableCell>{r.s30}</TableCell><TableCell>{fr(r.last)}</TableCell>
                <TableCell>{r.conditions ? "Oui" : "Non"}</TableCell><TableCell>{r.cart}</TableCell><TableCell>{r.orders}</TableCell>
              </TableRow>
            ))}
            {!data.rows.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune officine pilote (hors test).</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {data.requests.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow>{["Demande", "Officine", "Produit", "Statut", "Âge"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {data.requests.map((r: any) => (
                <TableRow key={r.id}><TableCell>{r.request_number ?? "—"}</TableCell><TableCell>{r.name}</TableCell><TableCell className="max-w-xs truncate">{r.product_description}</TableCell><TableCell>{r.status}</TableCell><TableCell>{r.age} j</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
