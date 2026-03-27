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

export const useProducts = () =>
  useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useOffersDirectAdmin = () =>
  useQuery({
    queryKey: ["admin-offers-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers_direct")
        .select("*, vendors(company_name), products(product_name)")
        .order("updated_at", { ascending: false });
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
        .select("*, vendors(company_name), buyers(company_name, type)")
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
        .select("*, manufacturers(name, country)")
        .order("gmv_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useManufacturers = () =>
  useQuery({
    queryKey: ["admin-manufacturers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manufacturers")
        .select("*")
        .order("products_on_mk", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useDisputes = () =>
  useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*, vendors(company_name), buyers(company_name), orders(order_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useInvoices = () =>
  useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
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

export const useVendorOnboarding = () =>
  useQuery({
    queryKey: ["admin-vendor-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_onboarding")
        .select("*, vendors(company_name, legal_form, email, contact_name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useOffersMarket = () =>
  useQuery({
    queryKey: ["admin-offers-market"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers_market")
        .select("*, products(product_name, cnk)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useLeadsPartners = () =>
  useQuery({
    queryKey: ["admin-leads-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_partners")
        .select("*")
        .order("revenue_30d", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useOffersIndirect = () =>
  useQuery({
    queryKey: ["admin-offers-indirect"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers_indirect")
        .select("*, products(product_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useComplianceRecords = () =>
  useQuery({
    queryKey: ["admin-compliance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_records")
        .select("*, products(product_name, brand, category_l1)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useImportJobs = () =>
  useQuery({
    queryKey: ["admin-import-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*, vendors(company_name)")
        .order("created_at", { ascending: false });
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
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export const useBuyers = () =>
  useQuery({
    queryKey: ["admin-buyers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

// Dashboard aggregated data
export const useDashboardStats = () => {
  const vendors = useVendors();
  const products = useProducts();
  const orders = useOrders();
  const disputes = useDisputes();

  const activeVendors = vendors.data?.filter(v => v.status === "active").length ?? 0;
  const totalProducts = products.data?.length ?? 0;
  const totalOrders = orders.data?.length ?? 0;
  const totalDisputes = disputes.data?.length ?? 0;
  const openDisputes = disputes.data?.filter(d => d.status !== "resolu" && d.status !== "rejete").length ?? 0;
  
  // Calculate GMV from orders
  const gmv = orders.data?.reduce((sum, o) => sum + (Number(o.total_ht) || Number(o.total) || 0), 0) ?? 0;

  return {
    activeVendors,
    totalProducts,
    totalOrders,
    gmv,
    totalDisputes,
    openDisputes,
    disputeRate: totalOrders > 0 ? ((openDisputes / totalOrders) * 100).toFixed(1) : "0",
    isLoading: vendors.isLoading || products.isLoading || orders.isLoading || disputes.isLoading,
  };
};
