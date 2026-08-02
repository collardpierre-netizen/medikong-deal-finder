import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadCagnotteHistory, loadFullCagnotteHistory, formatEur,
  type CagnotteHistoryFilter, type CagnotteMovement,
} from "@/hooks/useCagnotte";

const PAGE = 20;

const TYPE_META: Record<string, { dot: string; color: string; label: string }> = {
  earn: { dot: "🟢", color: "#16A085", label: "Gain" },
  spend: { dot: "🔴", color: "#E74C3C", label: "Utilisation" },
  expire: { dot: "🟡", color: "#95A5A6", label: "Expiration" },
  refund: { dot: "🔵", color: "#3498DB", label: "Remboursement" },
  adjustment: { dot: "⚪", color: "#9B59B6", label: "Ajustement" },
};

const FILTERS: { key: CagnotteHistoryFilter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "gains", label: "Gains" },
  { key: "depenses", label: "Dépenses" },
  { key: "expirations", label: "Expirations" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CagnotteHistoryModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<CagnotteHistoryFilter>("tous");
  const [rows, setRows] = useState<CagnotteMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, f: CagnotteHistoryFilter) => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data = await loadCagnotteHistory(user.id, f, offset, PAGE);
        setRows((prev) => (offset === 0 ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE);
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (open) fetchPage(0, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filter]);

  async function exportCsv() {
    if (!user?.id) return;
    setExporting(true);
    try {
      const all = await loadFullCagnotteHistory(user.id);
      const header = "date,type,montant,description,order_number";
      const lines = all.map((m) => {
        const orderRef = /commande\s+([A-Z0-9-]+)/i.exec(m.description || "")?.[1] ?? "";
        const desc = (m.description || "").replace(/"/g, '""');
        return `${new Date(m.created_at).toISOString().slice(0, 10)},${m.movement_type},${Number(m.amount_eur).toFixed(2)},"${desc}",${orderRef}`;
      });
      const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cagnotte-historique-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-6">
            <span>Ma cagnotte · Historique</span>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="ml-2">Exporter CSV</span>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                filter === f.key
                  ? "bg-mk-navy text-white border-mk-navy"
                  : "border-mk-line text-mk-sec hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-[50vh] overflow-y-auto divide-y divide-mk-line">
          {rows.length === 0 && !loading && (
            <p className="py-6 text-sm text-mk-sec text-center">Aucun mouvement pour ce filtre.</p>
          )}
          {rows.map((m) => {
            const meta = TYPE_META[m.movement_type] ?? TYPE_META.adjustment;
            const amount = Number(m.amount_eur);
            return (
              <div key={m.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-mk-navy truncate">
                    {meta.dot} {meta.label} · {fmtDate(m.created_at)}
                  </p>
                  <p className="text-xs text-mk-sec mt-0.5">{m.description}</p>
                </div>
                <span className="text-sm font-bold shrink-0" style={{ color: meta.color }}>
                  {amount > 0 ? "+" : "−"}{formatEur(Math.abs(amount))}
                </span>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <Button
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => fetchPage(rows.length, filter)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-2">Charger 20 de plus</span>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
