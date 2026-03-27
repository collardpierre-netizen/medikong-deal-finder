import { useState } from "react";
import { universes } from "@/data/mock";

export function UniversePills() {
  const [active, setActive] = useState(0);
  return (
    <div className="border-b border-mk-line py-3">
      <div className="mk-container flex items-center gap-2 overflow-x-auto">
        {universes.map((u, i) => (
          <button
            key={u}
            onClick={() => setActive(i)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              i === active
                ? "bg-mk-navy text-white"
                : "border border-mk-line text-mk-sec hover:border-mk-navy"
            }`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}
