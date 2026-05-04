// Statuts de commande côté acheteur — libellés FR + couleurs sémantiques
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "accepted"
  | "in_preparation"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderStatusMeta {
  label: string;
  /** classes tailwind pour badge (bg + text + border) */
  badgeClass: string;
  /** étape (0-based) dans le workflow visuel ; -1 = hors workflow (cancelled/refunded) */
  step: number;
}

export const ORDER_WORKFLOW_STEPS = [
  { key: "confirmed", label: "Confirmée" },
  { key: "accepted", label: "Reçue par le vendeur" },
  { key: "in_preparation", label: "En préparation" },
  { key: "shipped", label: "Expédiée" },
  { key: "delivered", label: "Livrée" },
] as const;

const META: Record<OrderStatus, OrderStatusMeta> = {
  pending:        { label: "En attente paiement", badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",     step: -1 },
  confirmed:      { label: "Confirmée",            badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",         step: 0  },
  accepted:       { label: "Reçue vendeur",        badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",            step: 1  },
  in_preparation: { label: "En préparation",       badgeClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",   step: 2  },
  shipped:        { label: "Expédiée",             badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",   step: 3  },
  delivered:      { label: "Livrée",               badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",step: 4  },
  cancelled:      { label: "Annulée",              badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",         step: -1 },
  refunded:       { label: "Remboursée",           badgeClass: "bg-stone-100 text-stone-700 border border-stone-200",     step: -1 },
};

export function getOrderStatusMeta(status: string | null | undefined): OrderStatusMeta {
  if (!status) return META.pending;
  return META[status as OrderStatus] ?? { label: status, badgeClass: "bg-mk-alt text-mk-sec border border-mk-line", step: -1 };
}

export function formatOrderDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
