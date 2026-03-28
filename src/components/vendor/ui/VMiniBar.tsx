interface VMiniBarProps {
  data: number[];
  color?: string;
}

export function VMiniBar({ data, color = "#1B5BDA" }: VMiniBarProps) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-7">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm min-w-[3px]"
          style={{
            height: `${Math.max(10, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: 0.3 + (i / data.length) * 0.7,
          }}
        />
      ))}
    </div>
  );
}
