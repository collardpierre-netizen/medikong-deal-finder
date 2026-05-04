import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

interface Props {
  value: number;
  max?: number | null;
  min?: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
}

export function QuantityInput({ value, max, min = 1, onChange, size = "md" }: Props) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  const clamp = (n: number) => {
    if (Number.isNaN(n)) return value;
    let v = Math.max(min, Math.floor(n));
    if (max && max > 0) v = Math.min(max, v);
    return v;
  };

  const commit = () => {
    const n = clamp(parseInt(local, 10));
    setLocal(String(n));
    if (n !== value) onChange(n);
  };

  const isSm = size === "sm";
  const btnCls = isSm ? "px-1.5 py-1 text-mk-sec hover:text-mk-navy" : "px-2 py-1.5 text-mk-sec hover:text-mk-navy";
  const inputCls = isSm
    ? "w-10 text-center text-sm font-medium bg-transparent outline-none focus:ring-1 focus:ring-mk-blue rounded"
    : "w-12 text-center text-sm font-medium bg-transparent outline-none focus:ring-1 focus:ring-mk-blue rounded";
  const iconSize = isSm ? 12 : 13;
  const atMax = !!max && value >= max;

  return (
    <div className="flex items-center border border-mk-line rounded-md">
      <button
        type="button"
        className={btnCls}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
      >
        <Minus size={iconSize} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max || undefined}
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={inputCls + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
      />
      <button
        type="button"
        className={btnCls + " disabled:opacity-40 disabled:cursor-not-allowed"}
        onClick={() => onChange(clamp(value + 1))}
        disabled={atMax}
      >
        <Plus size={iconSize} />
      </button>
    </div>
  );
}
