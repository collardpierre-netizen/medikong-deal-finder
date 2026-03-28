interface Tab {
  id: string;
  label: string;
  badge?: number;
}

interface VTabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function VTabBar({ tabs, active, onChange }: VTabBarProps) {
  return (
    <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap ${
            active === tab.id
              ? "bg-white text-[#1D2530] shadow-sm"
              : "text-[#616B7C] hover:text-[#1D2530]"
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold bg-[#1B5BDA] text-white px-1">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
