import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface OrderLike {
  status?: string | null;
}

interface Props {
  title: string;
  orders: OrderLike[];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:    { label: "En attente",    color: "#F59E0B" },
  confirmed:  { label: "Confirmées",    color: "#059669" },
  processing: { label: "En cours",      color: "#1B5BDA" },
  shipped:    { label: "Expédiées",     color: "#7C3AED" },
  delivered:  { label: "Livrées",       color: "#10B981" },
  cancelled:  { label: "Annulées",      color: "#EF4343" },
};

export default function OrdersStatusPieChart({ title, orders }: Props) {
  const { data, total } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) {
      const s = (o.status || "pending").toLowerCase();
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([status, count]) => ({
        status,
        count,
        label: STATUS_META[status]?.label ?? status,
        color: STATUS_META[status]?.color ?? "#94A3B8",
      }))
      .sort((a, b) => b.count - a.count);
    return { data: rows, total: rows.reduce((s, r) => s + r.count, 0) };
  }, [orders]);

  const hasData = total > 0;

  return (
    <div className="p-5 rounded-[10px] animate-fade-in" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold" style={{ color: "#1D2530" }}>{title}</h3>
        {hasData && (
          <span className="text-[11px]" style={{ color: "#8B95A5" }}>
            {total} commande{total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={88}
              paddingAngle={2}
              isAnimationActive
              animationDuration={650}
              animationEasing="ease-out"
            >
              {data.map((d) => (
                <Cell key={d.status} fill={d.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, ctx: any) => {
                const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0";
                return [`${value} (${pct}%)`, ctx?.payload?.label];
              }}
              contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[240px] text-[12px]" style={{ color: "#8B95A5" }}>
          Aucune commande
        </div>
      )}
    </div>
  );
}
