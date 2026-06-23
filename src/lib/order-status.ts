/**
 * Référentiel statuts commande — source unique de vérité.
 * Aligné avec orders.status en DB.
 */

export type OrderStatusKey =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderStatusFilter {
  key: "all" | OrderStatusKey;
  label: string;
}

export const ORDER_STATUS_FILTERS: OrderStatusFilter[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "processing", label: "En cours" },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En cours",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

/**
 * Statuts paiement facture (vendor/admin finance).
 */
export type InvoiceStatusKey = "paid" | "pending" | "overdue" | "cancelled";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusKey, string> = {
  paid: "Payée",
  pending: "En attente",
  overdue: "En retard",
  cancelled: "Annulée",
};

/**
 * Statuts expédition (logistique).
 */
export type ShipmentStatusKey =
  | "pending"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatusKey, string> = {
  pending: "En attente",
  shipped: "Expédié",
  in_transit: "En transit",
  delivered: "Livré",
  returned: "Retourné",
  cancelled: "Annulé",
};
