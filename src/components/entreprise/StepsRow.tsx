interface Step {
  number: number;
  title: string;
  description: string;
  color: "pink" | "blue" | "purple" | "green";
}

const colorMap = {
  pink: "bg-[#FFF1F5] text-[#E70866]",
  blue: "bg-[#EFF6FF] text-[#1B5BDA]",
  purple: "bg-[#F5F3FF] text-[#7C3AED]",
  green: "bg-[#ECFDF5] text-[#059669]",
};

export function StepsRow({ steps }: { steps: Step[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
      {steps.map((s) => (
        <div key={s.number} className="text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-[22px] font-bold mx-auto mb-4 ${colorMap[s.color]}`}>
            {s.number}
          </div>
          <h4 className="text-base font-bold text-[#1E293B] mb-2">{s.title}</h4>
          <p className="text-sm text-muted-foreground">{s.description}</p>
        </div>
      ))}
    </div>
  );
}
