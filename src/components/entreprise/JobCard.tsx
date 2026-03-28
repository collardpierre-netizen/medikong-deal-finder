import { MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Job } from "@/data/entreprise-data";

const deptColors: Record<string, string> = {
  Tech: "bg-[#EFF6FF] text-[#1B5BDA]",
  Sales: "bg-[#ECFDF5] text-[#059669]",
  Design: "bg-[#F5F3FF] text-[#7C3AED]",
  Analytics: "bg-[#FFF7ED] text-[#EA580C]",
};

export function JobCard({ title, department, location, contract }: Job) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 rounded-[14px] border border-border bg-white mb-3 hover:border-[#E70866] hover:shadow-[0_4px_12px_rgba(231,8,102,0.06)] transition-all gap-4">
      <div>
        <h4 className="text-base font-bold text-[#1E293B] mb-2">{title}</h4>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground items-center">
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${deptColors[department]}`}>
            {department}
          </span>
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{location}</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{contract}</span>
        </div>
      </div>
      <Button className="bg-[#1B5BDA] hover:bg-[#1549b8] text-white w-full md:w-auto">Postuler</Button>
    </div>
  );
}
