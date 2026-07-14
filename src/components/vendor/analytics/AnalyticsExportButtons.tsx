import { Download } from "lucide-react";

type Props = {
  disabled?: boolean;
  onCsv: () => void;
  onXlsx: () => void;
  label?: string;
};

/**
 * Small inline export controls for analytics tiles/tables.
 * Renders two buttons (CSV / XLSX) with a shared download icon.
 */
export function AnalyticsExportButtons({ disabled, onCsv, onXlsx, label = "Exporter" }: Props) {
  const base =
    "inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-[#E2E8F0] text-[11px] font-medium transition-colors";
  const enabled = "text-[#1D2530] bg-white hover:bg-[#F8FAFC]";
  const off = "text-[#B7C0CE] bg-[#F8FAFC] cursor-not-allowed";
  return (
    <div className="inline-flex items-center gap-1.5" aria-label={label}>
      <span className="text-[10px] uppercase tracking-wide text-[#8B95A5] font-medium mr-0.5 hidden sm:inline">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onCsv}
        className={`${base} ${disabled ? off : enabled}`}
      >
        <Download size={12} />
        CSV
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onXlsx}
        className={`${base} ${disabled ? off : enabled}`}
      >
        <Download size={12} />
        XLSX
      </button>
    </div>
  );
}
