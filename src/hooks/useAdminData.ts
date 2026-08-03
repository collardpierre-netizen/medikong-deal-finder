import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useVendors = () =>
  useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const PAGE = 1000;
      let all: any[] = [];
      let from = 0;
      // Paginate to bypass PostgREST hard cap of 1000 rows per request.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("vendors")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

export const useProducts = (limit = 100) =>
  useQuery({
    queryKey: ["admin-products", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });

export const useProductCount = () =>
  useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

export const useBrandCount = () =>
  useQuery({
    queryKey: ["admin-brands-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("brands")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

export const useActiveOfferCount = () =>
  useQuery({
    queryKey: ["admin-active-offers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("offers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

export const useOffers = () =>
  useQuery({
    queryKey: ["admin-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers_private" as any)
        .select("*, vendors(name, company_name), products(name)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

export const useOrders = () =>
  useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, draft_payload, was_forecast, forecast_created_at, forecast_converted_at, forecast_snapshot, customers(company_name, customer_type), order_lines(id, product_id, offer_id, vendor_id, quantity, unit_price_excl_vat, unit_price_incl_vat, vat_rate, line_total_excl_vat, line_total_incl_vat, cost_price, line_cost, line_margin, qogita_offer_qid, qogita_seller_fid, qogita_order_status, fulfillment_status, products(name, gtin, cnk_code, sku, image_url, primary_category_id), vendors(company_name, slug), offers(delivery_days)), sub_orders(commission_rate_override, commission_amount_override, subtotal_incl_vat)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useBrands = (search?: string) =>
  useQuery({
    queryKey: ["admin-brands", search?.trim() || ""],
    queryFn: async () => {
      const q = (search || "").trim();
      if (q) {
        // Recherche floue (trigram + unaccent) via RPC admin
        const { data, error } = await supabase.rpc("admin_search_brands_fuzzy", {
          _q: q,
          _limit: 50,
        });
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("product_count", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });


export const useAuditLogs = () =>
  useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

export const useCategories = () =>
  useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const useCategoryCount = () =>
  useQuery({
    queryKey: ["admin-categories-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("categories")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

export const useCustomers = () =>
  useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useMarginRules = () =>
  useQuery({
    queryKey: ["admin-margin-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useApiKeys = () =>
  useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*, customers(company_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useSyncLogs = () =>
  useQuery({
    queryKey: ["admin-sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

export const useSourcingRequests = () =>
  useQuery({
    queryKey: ["admin-sourcing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sourcing_requests")
        .select("*, customers(company_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

// Stub hooks for removed tables (V5 migration)
export const useBuyers = () => useQuery({ queryKey: ["stub-buyers"], queryFn: async () => [] as any[] });
export const useInvoices = () =>
  useQuery({
    queryKey: ["admin-order-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_invoices")
        .select("id, order_id, vendor_id, type, invoice_number, status, amount_excl_vat, vat_amount, amount_incl_vat, pdf_path, issued_at, paid_at, created_at, peppol_status, peppol_error, peppol_document_id, peppol_last_attempt_at, peppol_retry_count, orders:orders!order_invoices_order_id_fkey(order_number), vendors:vendors!order_invoices_vendor_id_fkey(company_name, name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        order_id: r.order_id,
        vendor_id: r.vendor_id,
        type: r.type,
        invoice_number: r.invoice_number,
        status: r.status,
        amount_ht: r.amount_excl_vat,
        tva_amount: r.vat_amount,
        amount_ttc: r.amount_incl_vat,
        due_date: r.paid_at || r.issued_at,
        pdf_path: r.pdf_path,
        order_number: r.orders?.order_number,
        vendor_label: r.vendors?.company_name || r.vendors?.name,
        peppol_status: r.peppol_status || null,
        peppol_error: r.peppol_error || null,
        peppol_document_id: r.peppol_document_id || null,
        peppol_last_attempt_at: r.peppol_last_attempt_at || null,
        peppol_retry_count: r.peppol_retry_count ?? 0,
      }));
    },
  });
export const useImportJobs = () => useQuery({ queryKey: ["stub-import-jobs"], queryFn: async () => [] as any[] });
export const useLeadsPartners = () => useQuery({ queryKey: ["stub-leads"], queryFn: async () => [] as any[] });
export const useOffersIndirect = () => useQuery({ queryKey: ["stub-offers-indirect"], queryFn: async () => [] as any[] });
export const useDisputes = () => useQuery({ queryKey: ["stub-disputes"], queryFn: async () => [] as any[] });
export const useManufacturers = () =>
  useQuery({
    queryKey: ["admin-manufacturers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("manufacturers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
export const useOffersDirectAdmin = () => useOffers();

// Dashboard aggregated data — use exact counts instead of fetching all rows
export const useDashboardStats = () => {
  const orders = useOrders();

  const countsQuery = useQuery({
    queryKey: ["admin-dashboard-counts"],
    queryFn: async () => {
      const [productsRes, vendorsRes, offersRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("offers").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        totalProducts: productsRes.count ?? 0,
        activeVendors: vendorsRes.count ?? 0,
        activeOffers: offersRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  // Exclure les commandes annulées/refusées du GMV et du total
  const EXCLUDED_STATUSES = new Set(["cancelled", "canceled", "refunded", "failed", "rejected"]);
  const allOrders = orders.data ?? [];
  const billableOrders = allOrders.filter((o: any) => !EXCLUDED_STATUSES.has(String(o.status ?? "").toLowerCase()) && !o.is_forecast);
  const totalOrders = billableOrders.length;
  const gmv = billableOrders.reduce((sum: number, o: any) => sum + (Number(o.total_incl_vat) || 0), 0);

  // Marge HTVA (réelle) = somme des line_margin sur lignes des commandes facturables
  const sumLines = (ordersList: any[], field: "line_margin" | "line_total_excl_vat") =>
    ordersList.reduce((sum: number, o: any) => {
      const lines = (o.order_lines ?? []) as any[];
      return sum + lines.reduce((s, l) => s + (Number(l?.[field]) || 0), 0);
    }, 0);

  const gmvExclVat = sumLines(billableOrders, "line_total_excl_vat");
  const gmvMargin = sumLines(billableOrders, "line_margin");
  const gmvMarginPct = gmvExclVat > 0 ? (gmvMargin / gmvExclVat) * 100 : 0;

  // Agrégat prévisionnel (inclut converties / annulées dès qu'elles ont été prévisionnelles)
  const forecastOrders = allOrders.filter((o: any) => o.was_forecast || o.is_forecast);
  const forecastGmv = forecastOrders.reduce((sum: number, o: any) => {
    const snap = Number(o.forecast_snapshot?.total_incl_vat);
    if (Number.isFinite(snap) && snap > 0) return sum + snap;
    return sum + (Number(o.total_incl_vat) || 0);
  }, 0);
  const forecastExclVat = sumLines(forecastOrders, "line_total_excl_vat");
  const forecastMargin = sumLines(forecastOrders, "line_margin");
  const forecastMarginPct = forecastExclVat > 0 ? (forecastMargin / forecastExclVat) * 100 : 0;

  return {
    activeVendors: countsQuery.data?.activeVendors ?? 0,
    totalProducts: countsQuery.data?.totalProducts ?? 0,
    totalOrders,
    gmv,
    gmvMargin,
    gmvMarginPct,
    forecastOrders: forecastOrders.length,
    forecastGmv,
    forecastMargin,
    forecastMarginPct,
    disputeRate: 0,
    isLoading: countsQuery.isLoading || orders.isLoading,
  };
};
