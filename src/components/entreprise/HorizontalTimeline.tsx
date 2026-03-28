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
          className="absolute top-[20px] left-0 h-[3px] bg-gradient-to-r from-[#1B5BDA] to-[#1549b8]"
          style={{ width: `${progressPercent}%` }}
        />

        {nodes.map((node, i) => (
          <div key={i} className="flex-1 min-w-[140px] text-center pt-12 relative group">
            {/* Dot */}
            <div
              className={`absolute top-[12px] left-1/2 -translate-x-1/2 w-[16px] h-[16px] rounded-full border-2 transition-all ${
                node.status === "past"
                  ? "bg-[#1B5BDA] border-[#1B5BDA]"
                  : node.status === "active"
                  ? "bg-[#1B5BDA] border-[#1B5BDA] shadow-[0_0_0_6px_rgba(27,91,218,0.15)]"
                  : "bg-white border-border group-hover:border-[#1B5BDA]"
              }`}
            />
            <p className="text-xs font-bold text-[#1B5BDA] uppercase tracking-wide mb-1">{node.year}</p>
            <p className="text-sm font-semibold text-[#1E293B] mb-1">{node.title}</p>
            <p className="text-xs text-muted-foreground px-2">{node.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
