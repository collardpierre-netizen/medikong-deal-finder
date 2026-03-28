import type { TimelineNode } from "@/data/entreprise-data";

export function HorizontalTimeline({ nodes }: { nodes: TimelineNode[] }) {
  const activeIndex = nodes.findIndex((n) => n.status === "active");
  const progressPercent = activeIndex >= 0 ? ((activeIndex + 0.5) / (nodes.length - 1)) * 100 : 0;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="relative flex min-w-[700px]">
        {/* Track */}
        <div className="absolute top-[20px] left-0 right-0 h-[3px] bg-border" />
        <div
          className="absolute top-[20px] left-0 h-[3px] bg-gradient-to-r from-[#E70866] to-[#DB2777]"
          style={{ width: `${progressPercent}%` }}
        />

        {nodes.map((node, i) => (
          <div key={i} className="flex-1 min-w-[140px] text-center pt-12 relative group">
            {/* Dot */}
            <div
              className={`absolute top-[12px] left-1/2 -translate-x-1/2 w-[16px] h-[16px] rounded-full border-2 transition-all ${
                node.status === "past"
                  ? "bg-[#E70866] border-[#E70866]"
                  : node.status === "active"
                  ? "bg-[#E70866] border-[#E70866] shadow-[0_0_0_6px_rgba(231,8,102,0.15)]"
                  : "bg-white border-border group-hover:border-[#E70866]"
              }`}
            />
            <p className="text-xs font-bold text-[#E70866] uppercase tracking-wide mb-1">{node.year}</p>
            <p className="text-sm font-semibold text-[#1E293B] mb-1">{node.title}</p>
            <p className="text-xs text-muted-foreground px-2">{node.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
