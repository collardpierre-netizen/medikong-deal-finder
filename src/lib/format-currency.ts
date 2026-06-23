/**
 * Format a number as a Belgian-French currency string (no symbol).
 * Always uses dot thousands separator + 2 decimals.
 * Example: 21388 -> "21.388,00"
 */
export const withDotThousands = (value: string): string =>
  value.replace(/(?<=\d)[\u00A0\u202F ](?=\d{3}(\D|$))/g, ".");

export const fmtEur = (n: number | null | undefined): string => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0,00";
  return withDotThousands(v.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }));
};

/** Same as fmtEur but appends " EUR". */
export const fmtEurLabel = (n: number | null | undefined): string => `${fmtEur(n)} EUR`;

/** Convert cents to euros then format. */
export const fmtEurFromCents = (cents: number | null | undefined): string =>
  fmtEur((Number(cents) || 0) / 100);
