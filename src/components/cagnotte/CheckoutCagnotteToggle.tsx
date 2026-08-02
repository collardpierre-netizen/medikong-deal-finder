import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useCagnotteBalance, useCagnotteSettings, formatEur } from "@/hooks/useCagnotte";

interface Props {
  /** Sous-total HT de la commande en cours */
  subtotalHt: number;
  /** Montant de cagnotte actuellement retenu (état local du checkout) */
  value: number;
  /** Remonte le montant retenu au parent (0 = désactivé) */
  onChange: (amount: number) => void;
}

/**
 * Toggle + slider d'utilisation de la cagnotte au checkout.
 * ⚠️ N'écrit RIEN en base : le mouvement 'spend' n'est créé qu'à la validation
 * finale du paiement via l'edge function apply-cagnotte.
 */
export function CheckoutCagnotteToggle({ subtotalHt, value, onChange }: Props) {
  const { data: balance } = useCagnotteBalance();
  const { data: settings } = useCagnotteSettings();
  const [enabled, setEnabled] = useState(false);

  const currentBalance = Number(balance?.current_balance ?? 0);
  const minSpend = settings?.minSpend ?? 0.5;
  const maxPct = settings?.maxSpendPct ?? 0.3;
  const maxFromOrder = Math.floor(subtotalHt * maxPct * 100) / 100;
  const max = Math.min(currentBalance, maxFromOrder);

  // Le plafond change si le panier change → on recadre le montant retenu
  useEffect(() => {
    if (!enabled) return;
    if (max < minSpend) {
      setEnabled(false);
      onChange(0);
    } else if (value > max) {
      onChange(max);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, enabled]);

  if (currentBalance < minSpend) return null;

  const usable = max >= minSpend;

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    onChange(next ? max : 0);
  };

  return (
    <div
      className="rounded-[10px] px-4 py-3.5"
      style={{
        background: "linear-gradient(135deg, rgba(244,185,66,0.15), rgba(244,185,66,0.05))",
        border: "1px solid rgba(244,185,66,0.3)",
      }}
    >
      <div className="flex items-start gap-3">
        <Switch
          checked={enabled}
          disabled={!usable}
          onCheckedChange={handleToggle}
          aria-label="Utiliser ma cagnotte"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-mk-navy flex items-center gap-1.5">
            <Coins size={14} className="text-[#D89620]" /> Utiliser ma cagnotte
          </p>
          <p className="text-xs text-mk-sec mt-0.5">
            Solde disponible : {formatEur(currentBalance)}
          </p>
          {!usable && (
            <p className="text-xs text-mk-ter mt-1">
              Montant utilisable insuffisant sur cette commande (plafond{" "}
              {formatEur(maxFromOrder)}).
            </p>
          )}
        </div>
      </div>

      {enabled && usable && (
        <div className="mt-3 pt-3 border-t border-[rgba(244,185,66,0.35)] space-y-2">
          <div className="flex items-center gap-3">
            <Slider
              className="flex-1"
              min={minSpend}
              max={max}
              step={0.5}
              value={[Math.min(Math.max(value, minSpend), max)]}
              onValueChange={([v]) => onChange(Math.round(v * 100) / 100)}
            />
            <span className="text-sm font-bold text-mk-navy w-[92px] text-right">
              {formatEur(value)}
            </span>
          </div>
          <p className="text-xs text-mk-sec">
            Maximum utilisable sur cette commande : {formatEur(max)} (
            {Math.round(maxPct * 100)} % du sous-total)
          </p>
          <p className="text-xs text-mk-sec">
            Après cette commande, il vous restera{" "}
            {formatEur(Math.max(currentBalance - value, 0))} de cagnotte
          </p>
        </div>
      )}
    </div>
  );
}
