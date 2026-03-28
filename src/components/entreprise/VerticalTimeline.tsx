import type { VTimelineNode } from "@/data/entreprise-data";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function VerticalTimeline({ nodes }: { nodes: VTimelineNode[] }) {
  return (
    <div className="relative pl-8 max-w-[600px] mx-auto">
      <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-border" />
      {nodes.map((node, i) => (
        <TimelineItem key={i} node={node} index={i} />
      ))}
    </div>
  );
}

function TimelineItem({ node, index }: { node: VTimelineNode; index: number }) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`relative pl-8 pb-10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-5"
      }`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      <div
        className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 ${
          node.status === "past"
            ? "bg-[#E70866] border-[#E70866]"
            : node.status === "current"
            ? "bg-[#E70866] border-[#E70866] shadow-[0_0_0_6px_rgba(231,8,102,0.15)] animate-pulse"
            : "bg-white border-border"
        }`}
      />
      <p className="text-xs font-bold text-[#E70866] uppercase tracking-wide mb-1">{node.year}</p>
      <p className="text-[17px] font-bold text-[#1E293B] mb-1">{node.title}</p>
      <p className="text-sm text-muted-foreground">{node.desc}</p>
    </div>
  );
}
