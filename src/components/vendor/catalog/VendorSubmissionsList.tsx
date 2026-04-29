import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, Archive, Loader2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { Badge } from "@/components/ui/badge";
import { formatUpdatedAt } from "@/lib/format-date";

type Status = "submitted" | "in_review" | "approved" | "rejected" | "needs_changes";

const STATUS_META: Record<Status, { label: string; icon: any; className: string }> = {
  submitted: { label: "En attente d'examen", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-200" },
  in_review: { label: "En cours d'examen", icon: Clock, className: "bg-blue-100 text-blue-800 border-blue-200" },
  approved: { label: "Validé / Publié", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Refusé", icon: XCircle, className: "bg-rose-100 text-rose-800 border-rose-200" },
  needs_changes: { label: "Modifications demandées", icon: Archive, className: "bg-orange-100 text-orange-800 border-orange-200" },
};

export function VendorSubmissionsList() {
  const { data: vendor } = useCurrentVendor();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["vendor-submissions", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_submissions")
        .select("id, status, proposed_payload, review_comment, reviewed_at, created_at, updated_at, resulting_product_id")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!vendor?.id) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Inbox className="h-7 w-7 mb-2 opacity-60" />
        <p className="text-sm">Vous n'avez encore proposé aucun produit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it: any) => {
        const status = (it.status as Status) ?? "submitted";
        const meta = STATUS_META[status] ?? STATUS_META.submitted;
        const Icon = meta.icon;
        const payload = (it.proposed_payload ?? {}) as Record<string, any>;
        return (
          <div key={it.id} className="border rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {payload.product_name ?? "Produit sans nom"}
                </p>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                  {payload.brand_name && <span>{payload.brand_name}</span>}
                  {payload.gtin && <span>GTIN {payload.gtin}</span>}
                  {payload.cnk_code && <span>CNK {payload.cnk_code}</span>}
                  <span>· proposé le {formatUpdatedAt(it.created_at)}</span>
                </div>
              </div>
              <Badge variant="outline" className={`gap-1 shrink-0 ${meta.className}`}>
                <Icon className="h-3 w-3" /> {meta.label}
              </Badge>
            </div>

            {status === "rejected" && it.review_comment && (
              <div className="mt-2 text-[12px] bg-rose-50 border border-rose-200 text-rose-900 rounded p-2">
                <span className="font-semibold">Motif du refus : </span>{it.review_comment}
              </div>
            )}
            {status === "needs_changes" && it.review_comment && (
              <div className="mt-2 text-[12px] bg-orange-50 border border-orange-200 text-orange-900 rounded p-2">
                <span className="font-semibold">Modifications demandées : </span>{it.review_comment}
              </div>
            )}
            {status === "approved" && it.review_comment && (
              <div className="mt-2 text-[12px] bg-emerald-50 border border-emerald-200 text-emerald-900 rounded p-2">
                {it.review_comment}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
