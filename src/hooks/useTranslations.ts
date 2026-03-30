import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

type EntityType = "category" | "brand" | "product";

interface Translation {
  id: string;
  entity_type: string;
  entity_id: string;
  locale: string;
  field: string;
  value: string;
}

// Fetch all translations for an entity type
export function useEntityTranslations(entityType: EntityType) {
  return useQuery({
    queryKey: ["translations", entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("translations")
        .select("*")
        .eq("entity_type", entityType);
      if (error) throw error;
      return data as Translation[];
    },
  });
}

// Fetch translations for a single entity
export function useEntityItemTranslations(entityType: EntityType, entityId: string | null) {
  return useQuery({
    queryKey: ["translations", entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from("translations")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return data as Translation[];
    },
    enabled: !!entityId,
  });
}

// Save a translation (upsert)
export function useSaveTranslation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { entity_type: EntityType; entity_id: string; locale: string; field: string; value: string }) => {
      const { error } = await supabase
        .from("translations")
        .upsert(t, { onConflict: "entity_type,entity_id,locale,field" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["translations", vars.entity_type] });
      qc.invalidateQueries({ queryKey: ["translations", vars.entity_type, vars.entity_id] });
    },
  });
}

// Batch save translations
export function useBatchSaveTranslations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { entity_type: EntityType; entity_id: string; locale: string; field: string; value: string }[]) => {
      if (items.length === 0) return;
      const { error } = await supabase
        .from("translations")
        .upsert(items, { onConflict: "entity_type,entity_id,locale,field" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ["translations", vars[0].entity_type] });
      }
    },
  });
}

// Helper: get translated value from a translations array
export function getTranslated(
  translations: Translation[],
  entityId: string,
  field: string,
  locale: string,
  fallback: string
): string {
  const t = translations.find(
    tr => tr.entity_id === entityId && tr.field === field && tr.locale === locale
  );
  return t?.value || fallback;
}

// Hook: get current-locale translated name for display
export function useTranslatedName(
  translations: Translation[],
  entityId: string,
  originalName: string
): string {
  const { i18n } = useTranslation();
  const locale = i18n.language?.substring(0, 2) || "fr";
  if (locale === "en") return originalName;
  return getTranslated(translations, entityId, "name", locale, originalName);
}
