import { VCard } from "@/components/vendor/ui/VCard";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { useMoneyFormat } from "@/lib/money-format";
import type { CommissionTierState } from "@/hooks/useVendorMonthlyDashboard";
import { Info } from "lucide-react";

interface Props {
  gmvCents: number;
  commissionCents: number;
  netMarginCents: number;
  tier: CommissionTierState | null;
  loading?: boolean;
}

/**
 * Bloc GMV + Commission MediKong + Marge nette + jauge de progression
 * vers le prochain palier de commission négociée.
 */
export default function MediKongCommissionCard({
  gmvCents,
  commissionCents,
  netMarginCents,
  tier,
  loading,
}: Props) {
  const { formatMoney } = useMoneyFormat();

  return (
    <VCard>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Metric
          label="GMV (TTC)"
          value={formatMoney(gmvCents / 100, { fractionDigits: 0 })}
          hint="Volume brut ce mois"
          color="#1B5BDA"
          loading={loading}
        />
        <Metric
          label="Commission MediKong"
          value={formatMoney(commissionCents / 100, { fractionDigits: 0 })}
          hint={
            gmvCents > 0
              ? `${((commissionCents / gmvCents) * 100).toFixed(1)}% du GMV`
              : "—"
          }
          color="#7C3AED"
          loading={loading}
        />
        <Metric
          label="Marge nette"
          value={formatMoney(netMarginCents / 100, { fractionDigits: 0 })}
          hint="Marge brute − commission"
          color={netMarginCents >= 0 ? "#059669" : "#EF4444"}
          loading={loading}
        />
      </div>

      {tier && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
          <div className="flex items-baseline justify-between mb-1.5">
            <div>
              <p className="text-[12px] font-semibold text-[#1D2530]">
                Palier négocié
                {tier.isPlaceholder && (
                  <span
                    title="Barème indicatif — à remplacer par vos paliers négociés réels."
                    className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-normal text-[#8B95A5]"
                  >
                    <Info size={10} /> indicatif
                  </span>
                )}
              </p>
              <p className="text-[11px] text-[#616B7C]">
                Taux courant :{" "}
                <span className="font-semibold text-[#1D2530]">
                  {tier.currentPct != null ? `${tier.currentPct}%` : "—"}
                </span>
                {tier.nextPct != null && (
                  <>
                    {" "}· prochain palier :{" "}
                    <span className="font-semibold text-[#059669]">{tier.nextPct}%</span>
                  </>
                )}
              </p>
            </div>
            <span className="text-[11px] tabular-nums text-[#616B7C]">
              {formatMoney(tier.gmvCents / 100, { fractionDigits: 0 })}
              {tier.thresholdCents != null && (
                <>
                  {" "}/{" "}
                  {formatMoney(tier.thresholdCents / 100, { fractionDigits: 0 })}
                </>
              )}
            </span>
          </div>
          <VProgressBar value={tier.progressPct} max={100} color="#1B5BDA" height={8} />
          {tier.nextPct != null && tier.remainingCents > 0 && (
            <p className="mt-1.5 text-[11px] text-[#8B95A5]">
              Encore{" "}
              <span className="font-semibold text-[#1D2530]">
                {formatMoney(tier.remainingCents / 100, { fractionDigits: 0 })}
              </span>{" "}
              de GMV pour débloquer le palier {tier.nextPct}%.
            </p>
          )}
          {tier.nextPct == null && (
            <p className="mt-1.5 text-[11px] text-[#059669]">
              Palier maximum atteint sur la période.
            </p>
          )}
        </div>
      )}
    </VCard>
  );
}

function Metric({
  label,
  value,
  hint,
  color,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[#8B95A5] font-semibold">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 bg-[#F1F5F9] rounded mt-1 animate-pulse" />
      ) : (
        <p className="text-[22px] font-bold mt-0.5 tabular-nums" style={{ color }}>
          {value}
        </p>
      )}
      {hint && <p className="text-[11px] text-[#616B7C] mt-0.5">{hint}</p>}
    </div>
  );
}
