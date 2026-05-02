import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { parseDescriptionBlocks } from "@/lib/format-description";
import { Button } from "@/components/ui/button";

interface ProductDescriptionProps {
  description: string;
  /** Nombre approximatif de caractères avant troncature (clamp). */
  collapseThreshold?: number;
}

/**
 * Rendu propre d'une description produit issue de sources hétérogènes :
 * - normalise les retours à la ligne fragmentés
 * - rend les sous-titres type "Saveur Vanille :" comme petits headings
 * - clamp + bouton "Voir plus" si le texte est long
 */
export function ProductDescription({
  description,
  collapseThreshold = 600,
}: ProductDescriptionProps) {
  const blocks = useMemo(() => parseDescriptionBlocks(description), [description]);
  const totalLength = useMemo(
    () => blocks.reduce((acc, b) => acc + b.text.length, 0),
    [blocks]
  );
  const longText = totalLength > collapseThreshold;
  const [expanded, setExpanded] = useState(false);

  if (!description?.trim() || blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Description non disponible pour ce produit.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={
          longText && !expanded
            ? "relative max-h-64 overflow-hidden"
            : "relative"
        }
      >
        <div className="space-y-3">
          {blocks.map((block, idx) =>
            block.type === "heading" ? (
              <h3
                key={idx}
                className="text-sm font-semibold text-foreground mt-4 first:mt-0"
              >
                {block.text}
              </h3>
            ) : (
              <p
                key={idx}
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {block.text}
              </p>
            )
          )}
        </div>
        {longText && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>

      {longText && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-8 px-2 text-primary hover:text-primary"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Voir moins
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Voir plus
            </>
          )}
        </Button>
      )}
    </div>
  );
}
