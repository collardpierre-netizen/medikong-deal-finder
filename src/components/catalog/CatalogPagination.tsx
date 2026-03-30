import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
}

export function CatalogPagination({ page, perPage, total, onPageChange }: Props) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
      <p className="text-sm text-muted-foreground">
        Affichage {from.toLocaleString("fr-FR")}-{to.toLocaleString("fr-FR")} sur {total.toLocaleString("fr-FR")} produits
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-2 text-muted-foreground text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-8 h-8 px-2 rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:bg-muted"
              }`}
            >
              {p.toLocaleString("fr-FR")}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
