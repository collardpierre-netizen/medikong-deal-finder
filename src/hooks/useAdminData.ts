import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useVendors = () =>
  useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
        .select("*", { count: "exact", head: true })
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
        .from("offers")
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
        .select("*, customers(company_name, customer_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useBrands = () =>
  useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("product_count", { ascending: false });
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
export const useInvoices = () => useQuery({ queryKey: ["stub-invoices"], queryFn: async () => [] as any[] });
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

  const totalOrders = orders.data?.length ?? 0;
  const gmv = orders.data?.reduce((sum, o) => sum + (Number(o.total_incl_vat) || 0), 0) ?? 0;

  return {
    activeVendors: countsQuery.data?.activeVendors ?? 0,
    totalProducts: countsQuery.data?.totalProducts ?? 0,
    totalOrders,
    gmv,
    disputeRate: 0,
    isLoading: countsQuery.isLoading || orders.isLoading,
  };
};
