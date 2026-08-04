// Bloc dépliable "Comment est-elle calculée ?" (admin + apporteur).
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { explainCalc, type CalcDetails } from "@/lib/affiliate-format";

export function CommissionCalcDetails({
  details,
  internal = false,
  ruleVersion,
}: {
  details: CalcDetails | null | undefined;
  internal?: boolean;
  ruleVersion?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const lines = explainCalc(details, { internal });

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Comment est-elle calculée ?
      </button>
      {open && (
        <ul className="mt-2 space-y-1 rounded-md bg-muted/60 p-3 text-muted-foreground">
          {lines.map((l, i) => (
            <li key={i}>• {l}</li>
          ))}
          {ruleVersion != null && <li>• Version de règle appliquée : v{ruleVersion}.</li>}
        </ul>
      )}
    </div>
  );
}
