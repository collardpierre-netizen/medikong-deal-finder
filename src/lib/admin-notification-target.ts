import { supabase } from "@/integrations/supabase/client";

/**
 * Résolution du lien "profond" d'une notification admin.
 *
 * Beaucoup de notifications sont créées avec un `cta_url` générique
 * (ex. `/admin/commandes` pour un `source_type = 'sub_order'`), ce qui oblige
 * l'admin à re-chercher la commande à la main. On résout ici l'entité réelle
 * (sub-order → commande parente) pour pointer directement sur son détail.
 */
export interface NotifTargetInput {
  id: string;
  cta_url: string | null;
  source_type: string | null;
  source_id: string | null;
}

export interface NotifTarget {
  /** URL interne (react-router) ou absolue. */
  url: string;
  /** Libellé lisible de la cible, si connu (ex. "MK-2026-00042"). */
  label?: string;
  /** true si on a pu résoudre l'entité précise (et pas juste la liste). */
  deep: boolean;
}

/** Résout en batch les cibles de plusieurs notifications. */
export async function resolveNotificationTargets(
  notifs: NotifTargetInput[]
): Promise<Record<string, NotifTarget>> {
  const out: Record<string, NotifTarget> = {};

  // Base : cta_url tel quel.
  for (const n of notifs) {
    if (n.cta_url) out[n.id] = { url: n.cta_url, deep: false };
  }

  // ── sub_order → commande parente ────────────────────────────────
  const subOrderIds = [
    ...new Set(
      notifs
        .filter((n) => n.source_type === "sub_order" && n.source_id)
        .map((n) => n.source_id as string)
    ),
  ];

  if (subOrderIds.length > 0) {
    const { data } = await supabase
      .from("sub_orders")
      .select("id, order_id, orders(order_number)")
      .in("id", subOrderIds);

    const map = new Map<string, { orderId: string; orderNumber?: string }>();
    (data ?? []).forEach((row: any) => {
      if (row?.order_id) {
        map.set(row.id, {
          orderId: row.order_id,
          orderNumber: row.orders?.order_number ?? undefined,
        });
      }
    });

    for (const n of notifs) {
      if (n.source_type !== "sub_order" || !n.source_id) continue;
      const hit = map.get(n.source_id);
      if (!hit) continue;
      out[n.id] = {
        url: `/admin/commandes/${hit.orderId}`,
        label: hit.orderNumber,
        deep: true,
      };
    }
  }

  return out;
}

/** Résout la cible d'une seule notification. */
export async function resolveNotificationTarget(
  n: NotifTargetInput
): Promise<NotifTarget | null> {
  const map = await resolveNotificationTargets([n]);
  return map[n.id] ?? null;
}
