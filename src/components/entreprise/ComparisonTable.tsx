import { Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const rows = [
  { feature: "Comparaison de prix en temps réel", mk: true, trad: false },
  { feature: "Fournisseurs vérifiés AFMPS", mk: true, trad: false },
  { feature: "Paiement différé 30/60/90j", mk: true, trad: false },
  { feature: "Intégration ERP", mk: true, trad: false },
  { feature: "Support litige 24h", mk: true, trad: false },
  { feature: "Transparence des commissions", mk: true, trad: false },
  { feature: "Aucun engagement minimum", mk: true, trad: false },
];

export function ComparisonTable() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#1E293B] hover:bg-[#1E293B]">
            <TableHead className="text-white font-semibold">Critère</TableHead>
            <TableHead className="text-white font-semibold text-center">MediKong</TableHead>
            <TableHead className="text-white font-semibold text-center">Achat traditionnel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i} className={`${i % 2 === 0 ? "bg-[#F8FAFC]" : "bg-white"} hover:bg-[#F1F5F9]`}>
              <TableCell className="font-medium text-[#1E293B]">{r.feature}</TableCell>
              <TableCell className="text-center">
                <Check className="inline w-5 h-5 text-[#059669]" />
              </TableCell>
              <TableCell className="text-center">
                <X className="inline w-5 h-5 text-[#EF4444]" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
