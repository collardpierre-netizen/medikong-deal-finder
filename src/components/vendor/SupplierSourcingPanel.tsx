import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck } from "lucide-react";

interface SourcingLine {
  id: string;
  product_id: string | null;
  product_name?: string;
  quantity: number | null;
  qogita_seller_fid: string | null;
  qogita_offer_qid: string | null;
  cost_price: number | null;
}

interface Props {
  lines: SourcingLine[];
}

/**
 * Panneau « Approvisionnement fournisseur » — visible par le vendeur de
 * référence (Medista) sur les lignes issues du flux fournisseur automatisé.
 * Pousse uniquement : réf. + nom du vendeur fournisseur, produit, quantité et
 * prix d'achat. Le client final n'y apparaît jamais.
 */
export function SupplierSourcingPanel({ lines }: Props) {
  const sourcingLines = lines.filter((l) => !!l.qogita_seller_fid);
  const fids = [...new Set(sourcingLines.map((l) => l.qogita_seller_fid!))];
  const productIds = [...new Set(sourcingLines.map((l) => l.product_id).filter(Boolean) as string[])];

  const { data: vendorNames } = useQuery({
    queryKey: ["supplier-sourcing-vendors", fids],
    enabled: fids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendors")
        .select("name, qogita_seller_alias")
        .in("qogita_seller_alias", fids);
      return new Map((data || []).map((v) => [v.qogita_seller_alias as string, v.name as string]));
    },
  });

  // Alternatives : autres fournisseurs du même produit, si rupture au moment
  // où le vendeur de référence passe la commande.
  const { data: alternatives } = useQuery({
    queryKey: ["supplier-sourcing-alternatives", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("offers")
        .select("product_id, qogita_seller_fid, stock_quantity")
        .in("product_id", productIds)
        .eq("is_active", true)
        .not("qogita_seller_fid", "is", null)
        .order("stock_quantity", { ascending: false })
        .limit(200);
      const map = new Map<string, string[]>();
      for (const o of data || []) {
        const pid = o.product_id as string;
        const fid = o.qogita_seller_fid as string;
        const list = map.get(pid) || [];
        if (!list.includes(fid) && list.length < 3) list.push(fid);
        map.set(pid, list);
      }
      return map;
    },
  });

  if (sourcingLines.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Approvisionnement fournisseur</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Réf. fournisseur à commander pour cette vente. Le client final n'est pas transmis au fournisseur.
      </p>
      <div className="space-y-2">
        {sourcingLines.map((l) => {
          const fid = l.qogita_seller_fid!;
          const name = vendorNames?.get(fid) ?? `Vendeur ${fid}`;
          const alts = (alternatives?.get(l.product_id || "") || []).filter((f) => f !== fid);
          return (
            <div key={l.id} className="rounded-lg border border-border bg-background p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{l.product_name ?? "Article"}</span>
                <span className="text-muted-foreground">Qté : {l.quantity ?? 0}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  Fournisseur : <span className="text-foreground font-medium">{name}</span> (réf. {fid})
                </span>
                {l.qogita_offer_qid && <span>Offre : {l.qogita_offer_qid}</span>}
                {l.cost_price != null && (
                  <span>
                    Prix d'achat unitaire :{" "}
                    <span className="text-foreground font-medium">
                      {Number(l.cost_price).toFixed(2)} €
                    </span>
                  </span>
                )}
              </div>
              {alts.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Alternatives en cas de rupture : {alts.map((f) => `réf. ${f}`).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
