import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, AlertTriangle, Ban } from "lucide-react";

type Row = {
  window_days: number;
  total: number;
  sent: number;
  failed: number;
  bounced: number;
  complained: number;
  suppressed: number;
  success_rate: number;
  bounce_rate: number;
  complaint_rate: number;
};

const EmailDeliverabilityWidget = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-email-deliverability-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_email_deliverability_kpis");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const r7 = data?.find((r) => r.window_days === 7);
  const r30 = data?.find((r) => r.window_days === 30);

  return (
    <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>
          Délivrabilité emails transactionnels
        </h3>
        <span className="text-[11px]" style={{ color: "#8B95A5" }}>
          Source : email_send_log (déduplication par message_id)
        </span>
      </div>

      {isLoading && <p className="text-[13px] text-[#8B95A5]">Chargement…</p>}
      {error && (
        <p className="text-[13px] text-[#DC2626]">
          Erreur : {(error as Error).message}
        </p>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "7 derniers jours", row: r7 },
            { label: "30 derniers jours", row: r30 },
          ].map(({ label, row }) => (
            <div key={label} className="rounded border p-3" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold" style={{ color: "#1D2530" }}>{label}</span>
                <span className="text-[11px]" style={{ color: "#8B95A5" }}>
                  {row?.total ?? 0} email{(row?.total ?? 0) > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <Stat icon={CheckCircle2} color="#059669" label="Taux succès" value={`${row?.success_rate ?? 0} %`} sub={`${row?.sent ?? 0} envoyés`} />
                <Stat icon={AlertTriangle} color="#F59E0B" label="Échecs" value={`${row?.failed ?? 0}`} sub="failed + dlq" />
                <Stat icon={Ban} color="#DC2626" label="Bounces" value={`${row?.bounce_rate ?? 0} %`} sub={`${row?.bounced ?? 0} rejetés`} />
                <Stat icon={Mail} color="#7C3AED" label="Plaintes spam" value={`${row?.complaint_rate ?? 0} %`} sub={`${row?.complained ?? 0} signalements`} />
              </div>
              {(row?.suppressed ?? 0) > 0 && (
                <p className="text-[11px] mt-2" style={{ color: "#8B95A5" }}>
                  {row?.suppressed} bloqués (suppression list)
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Stat = ({
  icon: Icon, color, label, value, sub,
}: { icon: any; color: string; label: string; value: string; sub: string }) => (
  <div className="flex items-start gap-2">
    <Icon size={14} style={{ color, marginTop: 2 }} />
    <div className="leading-tight">
      <div className="text-[11px]" style={{ color: "#616B7C" }}>{label}</div>
      <div className="text-[13px] font-semibold" style={{ color: "#1D2530" }}>{value}</div>
      <div className="text-[10px]" style={{ color: "#8B95A5" }}>{sub}</div>
    </div>
  </div>
);

export default EmailDeliverabilityWidget;
