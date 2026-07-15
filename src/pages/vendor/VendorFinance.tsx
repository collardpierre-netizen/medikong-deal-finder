import { useQuery } from "@tanstack/react-query";
import { VCard } from "@/components/vendor/ui/VCard";
import { Wallet, Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { toast } from "sonner";

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const fmt = (n: number) =>
  n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";

export default function VendorFinance() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;

  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["vendor-statements-self", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_statements")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  async function download(pdfPath: string | null) {
    if (!pdfPath) return;
    const { data, error } = await supabase.storage
      .from("vendor-statements")
      .createSignedUrl(pdfPath, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Impossible de générer le lien du PDF");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Finances</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">
          Relevés mensuels de reversement Stripe Connect
        </p>
      </div>

      <VCard>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-[#1B5BDA]" />
            <h2 className="text-[15px] font-bold text-[#1D2530]">Relevés mensuels</h2>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-[13px] text-[#8B95A5]">Chargement…</div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet size={40} className="text-[#CBD5E1] mb-3" />
              <h3 className="text-[14px] font-bold text-[#1D2530] mb-1">Aucun relevé disponible</h3>
              <p className="text-[13px] text-[#8B95A5] max-w-md">
                Vos relevés mensuels seront générés automatiquement le 1er de chaque mois pour le mois précédent.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {["Période", "Commandes", "Ventes brutes TTC", "Commission HT", "Net transféré", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#8B95A5]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s: any) => (
                    <tr key={s.id} className="border-b border-[#F1F5F9]">
                      <td className="px-3 py-3 text-[13px] font-semibold text-[#1D2530]">
                        {MONTHS_FR[s.period_month - 1]} {s.period_year}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-[#616B7C]">{s.order_count}</td>
                      <td className="px-3 py-3 text-[12px] font-mono text-[#1D2530]">{fmt(Number(s.total_gross_ttc))}</td>
                      <td className="px-3 py-3 text-[12px] font-mono text-[#616B7C]">{fmt(Number(s.total_commission_ht))}</td>
                      <td className="px-3 py-3 text-[13px] font-mono font-bold text-[#059669]">{fmt(Number(s.total_net_transferred))}</td>
                      <td className="px-3 py-3">
                        {s.pdf_path && (
                          <button
                            onClick={() => download(s.pdf_path)}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded hover:bg-slate-100 text-[#1B5BDA]"
                          >
                            <Download size={13} /> PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </VCard>
    </div>
  );
}
