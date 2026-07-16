import { VCard } from "@/components/vendor/ui/VCard";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { useMoneyFormat } from "@/lib/money-format";
import type { VendorGmvProgress } from "@/hooks/useVendorGmvProgress";

interface Props {
  gmvCents: number;
  commissionCents: number;
  netMarginCents: number;
  progress: VendorGmvProgress | null;
  loading?: boolean;
  tradingCommissionCents?: number;
  marketplaceCommissionCents?: number;
}

/**
 * Bloc GMV + Commission MediKong + Marge nette + jauge de progression
 * vers le prochain palier de commission négociée (source : margin_rule_tiers).
 */
export default function MediKongCommissionCard({
  gmvCents,
  commissionCents,
  netMarginCents,
  progress,
  loading,
  tradingCommissionCents,
  marketplaceCommissionCents,
}: Props) {
  const { formatMoney } = useMoneyFormat();

  const windowLabel =
    progress?.gmv_window === "rolling_12m" ? "12 mois glissants" : "année en cours";
  const directionDecreasing = progress?.tiers_direction !== "increasing";
  const hasSplit =
    tradingCommissionCents !== undefined || marketplaceCommissionCents !== undefined;
  const tradingC = tradingCommissionCents ?? 0;
  const marketC = marketplaceCommissionCents ?? 0;

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
        <div>
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
          {hasSplit && !loading && (
            <div className="mt-2 space-y-1 border-t border-[#E2E8F0] pt-2">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-[#616B7C]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7C3AED] mr-1.5 align-middle" />
                  Trading <span className="text-[#8B95A5]">(100% marge)</span>
                </span>
                <span className="font-semibold tabular-nums text-[#1D2530]">
                  {formatMoney(tradingC / 100, { fractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-[#616B7C]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F59E0B] mr-1.5 align-middle" />
                  Marketplace <span className="text-[#8B95A5]">(% CA)</span>
                </span>
                <span className="font-semibold tabular-nums text-[#1D2530]">
                  {formatMoney(marketC / 100, { fractionDigits: 0 })}
                </span>
              </div>
            </div>
          )}
        </div>
        <Metric
          label="Marge nette"
          value={formatMoney(netMarginCents / 100, { fractionDigits: 0 })}
          hint="Marge brute − commission"
          color={netMarginCents >= 0 ? "#059669" : "#EF4444"}
          loading={loading}
        />

      </div>

      {progress && progress.has_tiers && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
          <div className="flex items-baseline justify-between mb-1.5">
            <div>
              <p className="text-[12px] font-semibold text-[#1D2530]">
                Palier de commission négociée
                <span className="ml-1.5 text-[10px] font-normal text-[#8B95A5]">
                  · {windowLabel}
                </span>
              </p>
              <p className="text-[11px] text-[#616B7C]">
                Taux courant :{" "}
                <span className="font-semibold text-[#1D2530]">
                  {progress.current_tier_percentage != null
                    ? `${Number(progress.current_tier_percentage).toFixed(2).replace(/\.00$/, "")}%`
                    : "—"}
                </span>
                {progress.current_tier_label && (
                  <span className="text-[#8B95A5]"> ({progress.current_tier_label})</span>
                )}
                {progress.next_tier_percentage != null && (
                  <>
                    {" "}· prochain palier :{" "}
                    <span
                      className={`font-semibold ${
                        directionDecreasing ? "text-[#059669]" : "text-[#1B5BDA]"
                      }`}
                    >
                      {Number(progress.next_tier_percentage).toFixed(2).replace(/\.00$/, "")}%
                    </span>
                  </>
                )}
              </p>
            </div>
            <span className="text-[11px] tabular-nums text-[#616B7C]">
              {formatMoney(progress.current_gmv_cents / 100, { fractionDigits: 0 })}
              {progress.next_tier_min_gmv_cents != null && (
                <>
                  {" "}/{" "}
                  {formatMoney(progress.next_tier_min_gmv_cents / 100, { fractionDigits: 0 })}
                </>
              )}
            </span>
          </div>
          <VProgressBar
            value={progress.progress_pct}
            max={100}
            color={directionDecreasing ? "#059669" : "#1B5BDA"}
            height={8}
          />
          {progress.next_tier_min_gmv_cents != null &&
            progress.next_tier_min_gmv_cents > progress.current_gmv_cents && (
              <p className="mt-1.5 text-[11px] text-[#8B95A5]">
                Encore{" "}
                <span className="font-semibold text-[#1D2530]">
                  {formatMoney(
                    (progress.next_tier_min_gmv_cents - progress.current_gmv_cents) / 100,
                    { fractionDigits: 0 },
                  )}
                </span>{" "}
                de GMV HT pour{" "}
                {directionDecreasing ? "débloquer" : "atteindre"} le palier{" "}
                {Number(progress.next_tier_percentage).toFixed(2).replace(/\.00$/, "")}%.
              </p>
            )}
          {progress.next_tier_percentage == null && (
            <p className="mt-1.5 text-[11px] text-[#059669]">
              Palier maximum atteint sur la période.
            </p>
          )}
          {directionDecreasing && progress.base_percentage != null && (
            <p className="mt-1 text-[10px] text-[#8B95A5]">
              Sous les seuils, le taux repasse à{" "}
              {Number(progress.base_percentage).toFixed(2).replace(/\.00$/, "")}% (taux de base).
            </p>
          )}
        </div>
      )}

      {progress && !progress.has_tiers && progress.base_percentage != null && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#616B7C]">
            Taux de commission actuel :{" "}
            <span className="font-semibold text-[#1D2530]">
              {Number(progress.base_percentage).toFixed(2).replace(/\.00$/, "")}%
            </span>
            <span className="text-[#8B95A5]">
              {" "}· aucun palier négocié configuré
            </span>
          </p>
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
