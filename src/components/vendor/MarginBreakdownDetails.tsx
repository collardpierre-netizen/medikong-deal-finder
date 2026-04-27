import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Calculator, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtEur, fmtPct, type CommissionModel, type MarginBreakdown } from "@/lib/vendorMargin";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  breakdown: MarginBreakdown;
  commissionModel: CommissionModel;
  /** Optional rate / split / fixed used in the live formula (for display) */
  commissionRate?: number | null;
  marginSplitPct?: number | null;
  fixedCommissionAmount?: number | null;
  /** If provided, we load the latest persisted snapshot for this offer */
  offerId?: string | null;
}

interface Snapshot {
  computed_at: string;
  trigger_source: string;
  sell_price_excl_vat: number;
  purchase_price_excl_vat: number | null;
  commission_model: string;
  commission_rate: number | null;
  margin_split_pct: number | null;
  fixed_commission_amount: number | null;
  commission_amount: number;
  commission_pct: number | null;
  net_revenue: number;
  gross_margin: number | null;
  net_margin: number | null;
  net_margin_pct: number | null;
}

function formulaFor(
  model: CommissionModel,
  rate?: number | null,
  split?: number | null,
  fixed?: number | null,
): { label: string; expression: string } {
  switch (model) {
    case "flat_percentage":
      return {
        label: "Pourcentage fixe",
        expression: `Commission = Prix de vente × ${rate ?? 0} %`,
      };
    case "margin_split":
      return {
        label: "Partage de marge",
        expression: `Commission = max(0, Prix de vente − Prix d'achat) × ${Math.max(0, 100 - (split ?? 0))} %`,
      };
    case "fixed_amount":
      return {
        label: "Montant fixe par unité",
        expression: `Commission = ${fmtEur(fixed ?? 0)} (forfait par unité vendue)`,
      };
  }
}

/**
 * Section repliable "Détail du calcul" :
 * - Explique la formule appliquée selon le modèle de commission
 * - Liste les variables utilisées en direct (vente, achat, commission, net)
 * - Affiche la dernière trace persistée en base (offer_margin_snapshots)
 *   avec date + valeurs exactes utilisées au moment du dernier update.
 */
export function MarginBreakdownDetails({
  breakdown,
  commissionModel,
  commissionRate,
  marginSplitPct,
  fixedCommissionAmount,
  offerId,
}: Props) {
  const [open, setOpen] = useState(false);

  const { data: lastSnapshot, isLoading } = useQuery({
    enabled: open && !!offerId,
    queryKey: ["offer-margin-snapshot-latest", offerId],
    queryFn: async (): Promise<Snapshot | null> => {
      if (!offerId) return null;
      const { data, error } = await supabase
        .from("offer_margin_snapshots" as any)
        .select("*")
        .eq("offer_id", offerId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data as any) ?? null;
    },
  });

  const formula = formulaFor(
    commissionModel,
    commissionRate,
    marginSplitPct,
    fixedCommissionAmount,
  );

  return (
    <div className="rounded-lg border" style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold"
        style={{ color: "#1D2530" }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Calculator size={13} style={{ color: "#1B5BDA" }} />
          Détail du calcul du net en poche
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 text-[12px]" style={{ color: "#1D2530" }}>
          {/* Formule appliquée */}
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "#8B95A5" }}>
              Modèle de commission
            </div>
            <div className="font-medium">{formula.label}</div>
            <code
              className="block mt-1 text-[11px] px-2 py-1.5 rounded font-mono"
              style={{ backgroundColor: "#F1F5F9", color: "#1E293B" }}
            >
              {formula.expression}
            </code>
            <code
              className="block mt-1 text-[11px] px-2 py-1.5 rounded font-mono"
              style={{ backgroundColor: "#F1F5F9", color: "#1E293B" }}
            >
              Net en poche = Prix de vente − Commission
            </code>
            {breakdown.hasCost && (
              <code
                className="block mt-1 text-[11px] px-2 py-1.5 rounded font-mono"
                style={{ backgroundColor: "#F1F5F9", color: "#1E293B" }}
              >
                Marge nette = Prix de vente − Prix d'achat − Commission
              </code>
            )}
          </div>

          {/* Variables actuelles */}
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "#8B95A5" }}>
              Variables utilisées (calcul en direct)
            </div>
            <table className="w-full tabular-nums">
              <tbody>
                <Row label="Prix de vente HTVA" value={fmtEur(breakdown.sellPrice)} />
                <Row
                  label="Prix d'achat HTVA"
                  value={breakdown.hasCost ? fmtEur(breakdown.purchasePrice) : "non renseigné"}
                  muted={!breakdown.hasCost}
                />
                <Row
                  label="− Commission MediKong"
                  value={`${fmtEur(breakdown.commission)} (${fmtPct(breakdown.commissionPct)})`}
                  highlight="commission"
                />
                <Row
                  label="= Net en poche"
                  value={fmtEur(breakdown.netRevenue)}
                  highlight="net"
                />
                {breakdown.hasCost && (
                  <Row
                    label="= Marge nette"
                    value={`${fmtEur(breakdown.netMargin)} (${fmtPct(breakdown.netMarginPct)})`}
                    highlight={breakdown.netMargin >= 0 ? "positive" : "negative"}
                  />
                )}
              </tbody>
            </table>
          </div>

          {/* Dernière trace persistée */}
          {offerId && (
            <div>
              <div className="text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: "#8B95A5" }}>
                <History size={10} /> Dernière trace enregistrée
              </div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "#8B95A5" }}>
                  <Loader2 size={11} className="animate-spin" /> Chargement…
                </div>
              ) : !lastSnapshot ? (
                <div className="text-[11px]" style={{ color: "#8B95A5" }}>
                  Aucune trace : aucun changement de prix ou de coût n'a encore été persisté.
                </div>
              ) : (
                <div className="rounded-md border p-2" style={{ borderColor: "#E2E8F0", backgroundColor: "#FAFBFC" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px]" style={{ color: "#1D2530" }}>
                      <span className="font-semibold">
                        {new Date(lastSnapshot.computed_at).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>{" "}
                      <span style={{ color: "#8B95A5" }}>
                        ({formatDistanceToNow(new Date(lastSnapshot.computed_at), {
                          addSuffix: true,
                          locale: fr,
                        })})
                      </span>
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "#EEF2FF", color: "#1B5BDA" }}
                    >
                      {lastSnapshot.trigger_source}
                    </span>
                  </div>
                  <table className="w-full tabular-nums text-[11px]">
                    <tbody>
                      <Row label="Prix de vente" value={fmtEur(Number(lastSnapshot.sell_price_excl_vat))} small />
                      <Row
                        label="Prix d'achat"
                        value={
                          lastSnapshot.purchase_price_excl_vat != null
                            ? fmtEur(Number(lastSnapshot.purchase_price_excl_vat))
                            : "—"
                        }
                        small
                        muted={lastSnapshot.purchase_price_excl_vat == null}
                      />
                      <Row
                        label={`Modèle (${lastSnapshot.commission_model})`}
                        value={
                          lastSnapshot.commission_model === "flat_percentage"
                            ? `${lastSnapshot.commission_rate ?? 0} %`
                            : lastSnapshot.commission_model === "margin_split"
                              ? `vendeur ${lastSnapshot.margin_split_pct ?? 0} %`
                              : `${fmtEur(Number(lastSnapshot.fixed_commission_amount ?? 0))}/u`
                        }
                        small
                        muted
                      />
                      <Row
                        label="Commission"
                        value={`${fmtEur(Number(lastSnapshot.commission_amount))} (${fmtPct(Number(lastSnapshot.commission_pct ?? 0))})`}
                        small
                        highlight="commission"
                      />
                      <Row
                        label="Net en poche"
                        value={fmtEur(Number(lastSnapshot.net_revenue))}
                        small
                        highlight="net"
                      />
                      {lastSnapshot.net_margin != null && (
                        <Row
                          label="Marge nette"
                          value={`${fmtEur(Number(lastSnapshot.net_margin))} (${fmtPct(Number(lastSnapshot.net_margin_pct ?? 0))})`}
                          small
                          highlight={Number(lastSnapshot.net_margin) >= 0 ? "positive" : "negative"}
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[10px] mt-1.5" style={{ color: "#8B95A5" }}>
                Une trace est enregistrée automatiquement à chaque changement du prix de vente ou du prix d'achat.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  muted,
  small,
}: {
  label: string;
  value: string;
  highlight?: "commission" | "net" | "positive" | "negative";
  muted?: boolean;
  small?: boolean;
}) {
  const color =
    highlight === "commission"
      ? "#EF4343"
      : highlight === "net"
        ? "#1B5BDA"
        : highlight === "positive"
          ? "#059669"
          : highlight === "negative"
            ? "#EF4343"
            : muted
              ? "#8B95A5"
              : "#1D2530";
  const fontWeight = highlight === "net" || highlight === "positive" || highlight === "negative" ? 700 : 500;
  const sz = small ? "text-[11px]" : "text-[12px]";
  return (
    <tr>
      <td className={`py-0.5 pr-2 ${sz}`} style={{ color: muted ? "#8B95A5" : "#616B7C" }}>
        {label}
      </td>
      <td className={`py-0.5 text-right ${sz}`} style={{ color, fontWeight }}>
        {value}
      </td>
    </tr>
  );
}
