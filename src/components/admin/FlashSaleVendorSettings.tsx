import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Store } from "lucide-react";

export interface FlashSaleVendorRow {
  vendor_id: string;
  vendor_name: string | null;
  company_name: string | null;
  display_code: string | null;
  vendor_type: string | null;
  validation_status: string | null;
  active_offers_count: number;
  is_enabled: boolean;
  max_discount_pct: number | null;
  allow_real_name: boolean;
  internal_note: string | null;
}

export function useFlashSaleVendors() {
  return useQuery({
    queryKey: ["flash-sale-vendors"],
    queryFn: async (): Promise<FlashSaleVendorRow[]> => {
      const { data, error } = await supabase.rpc("admin_flash_sale_vendors");
      if (error) throw error;
      return (data ?? []) as FlashSaleVendorRow[];
    },
  });
}

export function FlashSaleVendorSettings() {
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useFlashSaleVendors();
  const [search, setSearch] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);

  const upsert = useMutation({
    mutationFn: async (payload: {
      vendor_id: string;
      is_enabled?: boolean;
      allow_real_name?: boolean;
      max_discount_pct?: number | null;
    }) => {
      const { error } = await supabase
        .from("flash_sale_vendor_settings")
        .upsert(payload, { onConflict: "vendor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flash-sale-vendors"] });
      qc.invalidateQueries({ queryKey: ["flash-deal-candidates"] });
      toast.success("Réglage fournisseur enregistré");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (onlyEnabled && !v.is_enabled) return false;
      if (!q) return true;
      return [v.company_name, v.vendor_name, v.display_code]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [vendors, search, onlyEnabled]);

  const enabledCount = vendors.filter((v) => v.is_enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <p className="text-sm text-muted-foreground">
          Choisissez les fournisseurs autorisés aux ventes flash. Seules leurs offres sont proposées
          dans l'onglet « Suggestions ».{" "}
          <strong>{enabledCount}</strong> / {vendors.length} autorisés.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={onlyEnabled} onCheckedChange={setOnlyEnabled} />
            Autorisés uniquement
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-9 w-64"
              placeholder="Rechercher un fournisseur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Offres actives</TableHead>
              <TableHead className="text-center">Ventes flash</TableHead>
              <TableHead className="text-center">Nom réel autorisé</TableHead>
              <TableHead className="text-right">Remise max %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Aucun fournisseur</TableCell></TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.vendor_id}>
                  <TableCell className="font-medium max-w-[260px] truncate">
                    <span className="inline-flex items-center gap-2">
                      <Store size={14} className="text-muted-foreground" />
                      {v.company_name || v.vendor_name || v.display_code || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{v.display_code || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={v.validation_status === "accepted" || v.validation_status === "approved" ? "outline" : "secondary"} className="text-[10px]">
                      {v.validation_status || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{v.active_offers_count}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={v.is_enabled}
                      onCheckedChange={(checked) =>
                        upsert.mutate({ vendor_id: v.vendor_id, is_enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={v.allow_real_name}
                      onCheckedChange={(checked) =>
                        upsert.mutate({ vendor_id: v.vendor_id, allow_real_name: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      max="90"
                      step="1"
                      defaultValue={v.max_discount_pct ?? ""}
                      placeholder="—"
                      className="h-8 w-20 ml-auto text-right"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const val = raw === "" ? null : Number(raw);
                        if (val !== null && (!Number.isFinite(val) || val < 0 || val > 90)) {
                          toast.error("Remise max invalide (0-90)");
                          return;
                        }
                        if ((v.max_discount_pct ?? null) === val) return;
                        upsert.mutate({ vendor_id: v.vendor_id, max_discount_pct: val });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
