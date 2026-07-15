import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BePharmacy {
  id: string;
  apb_number: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  source: string | null;
  imported_at: string | null;
}

export function useBePharmaciesSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ["be-pharmacies-search", query],
    enabled: enabled && query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim();
      const { data, error } = await (supabase as any)
        .from("be_pharmacies")
        .select("id, apb_number, name, postal_code, city")
        .or(
          `name.ilike.%${q}%,apb_number.ilike.%${q}%,city.ilike.%${q}%,postal_code.ilike.%${q}%`,
        )
        .eq("is_active", true)
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Pick<
        BePharmacy,
        "id" | "apb_number" | "name" | "postal_code" | "city"
      >[];
    },
  });
}

export function useBePharmaciesList(params: { search?: string; limit?: number } = {}) {
  const { search = "", limit = 50 } = params;
  return useQuery({
    queryKey: ["be-pharmacies-list", search, limit],
    queryFn: async () => {
      let q = (supabase as any)
        .from("be_pharmacies")
        .select("*", { count: "exact" })
        .order("name", { ascending: true })
        .limit(limit);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(
          `name.ilike.%${s}%,apb_number.ilike.%${s}%,city.ilike.%${s}%,postal_code.ilike.%${s}%`,
        );
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as BePharmacy[], count: count ?? 0 };
    },
  });
}

export interface BePharmacyImportRow {
  apb_number: string;
  name: string;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function useUpsertBePharmacies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: BePharmacyImportRow[]) => {
      if (!rows.length) return 0;
      const payload = rows.map((r) => ({
        ...r,
        country_code: "BE",
        source: "admin_import",
        imported_at: new Date().toISOString(),
        is_active: true,
      }));
      // Chunks pour éviter payloads trop gros
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await (supabase as any)
          .from("be_pharmacies")
          .upsert(chunk, { onConflict: "apb_number" });
        if (error) throw error;
        inserted += chunk.length;
      }
      return inserted;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["be-pharmacies-list"] }),
  });
}
