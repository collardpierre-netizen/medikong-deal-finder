import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_HIDE_TEST_ORDERS_DEFAULT } from "@/lib/admin-order-filters";

export type OrdersPageFilters = {
  status?: string;                        // 'all' | order status
  dateFrom?: string | null;               // ISO
  dateTo?: string | null;                 // ISO
  vendorIds?: string[];                   // vendor filter
  search?: string | null;
  onlyWithCommission?: boolean;
  forecastFilter?: "all" | "real" | "forecast";
  hideTest?: boolean;
  hideDeleted?: boolean;
  buyerType?: string;                     // 'all' | customers.customer_type
  paymentStatus?: string;                 // 'all' | orders.payment_status
  billingStatus?: string;                 // 'all' | to_invoice/invoiced/partial/paid/overdue/cancelled/na
  sortBy?: "date" | "total" | "payment" | "billing";
  sortDir?: "asc" | "desc";
  billingUpdatedFrom?: string | null;
  billingUpdatedTo?: string | null;
};

export type OrdersPage = {
  rows: any[];
  total: number;
  statusCounts: Record<string, number>;
  kpis: {
    gmv_ht: number;
    gmv_ttc: number;
    orders_count: number;
    forecast_count: number;
    commission_total: number;
    margin_total: number;
    margin_base_ht: number;
  };
};

/**
 * Server-side paginated + filtered admin orders list.
 * Uses RPC admin_list_orders (filters + aggregates applied in SQL).
 */
export const useAdminOrdersPaginated = (
  filters: OrdersPageFilters,
  page: number,
  pageSize: number,
) => {
  const offset = Math.max(0, (page - 1) * pageSize);

  return useQuery<OrdersPage>({
    queryKey: ["admin-orders-paginated", filters, page, pageSize],
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_orders" as any, {
        _status: filters.status ?? "all",
        _date_from: filters.dateFrom || null,
        _date_to: filters.dateTo || null,
        _vendor_ids: filters.vendorIds && filters.vendorIds.length > 0 ? filters.vendorIds : null,
        _search: filters.search || null,
        _only_with_commission: !!filters.onlyWithCommission,
        _forecast_filter: filters.forecastFilter ?? "all",
        _hide_test: filters.hideTest ?? ADMIN_HIDE_TEST_ORDERS_DEFAULT,
        _hide_deleted: filters.hideDeleted ?? true,
        _limit: pageSize,
        _offset: offset,
        _buyer_type: filters.buyerType ?? "all",
        _payment_status: filters.paymentStatus ?? "all",
        _billing_status: filters.billingStatus ?? "all",
        _sort_by: filters.sortBy ?? "date",
        _sort_dir: filters.sortDir ?? "desc",
        _billing_updated_from: filters.billingUpdatedFrom || null,
        _billing_updated_to: filters.billingUpdatedTo || null,
      });
      if (error) throw error;

      const payload = (data as any) || {};
      const rawRows: any[] = payload.rows ?? [];

      // Normalize rows: rehydrate customers/order_lines/sub_orders in the shape
      // the existing UI code expects (matches useOrders() shape).
      const rows = rawRows.map((r: any) => ({
        ...r,
        customers: r.customer_row ?? null,
        order_lines: Array.isArray(r.lines_json) ? r.lines_json : [],
        sub_orders: Array.isArray(r.subs_json) ? r.subs_json : [],
      }));

      return {
        rows,
        total: Number(payload.total) || 0,
        statusCounts: payload.status_counts ?? {},
        kpis: {
          gmv_ht: Number(payload.kpis?.gmv_ht ?? payload.kpis?.total_ht) || 0,
          gmv_ttc: Number(payload.kpis?.gmv_ttc ?? payload.kpis?.total_incl_vat) || 0,
          orders_count: Number(payload.kpis?.orders_count) || 0,
          forecast_count: Number(payload.kpis?.forecast_count) || 0,
          commission_total: Number(payload.kpis?.commission_total) || 0,
          margin_total: Number(payload.kpis?.margin_total) || 0,
          margin_base_ht: Number(payload.kpis?.margin_base_ht) || 0,
        },
      };
    },
  });
};
