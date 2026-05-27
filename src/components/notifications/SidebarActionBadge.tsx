import { useActionCenter, type ActionCenterScope } from "@/hooks/useActionCenter";

interface Props {
  scope: ActionCenterScope;
  sectionKey: string;
  enabled?: boolean;
}

/** Tiny red bullet/count rendered next to a sidebar nav item. */
export function SidebarActionBadge({ scope, sectionKey, enabled = true }: Props) {
  const { data } = useActionCenter(scope, enabled);
  const count = data?.sections.find((s) => s.key === sectionKey)?.count ?? 0;
  if (count <= 0) return null;
  return (
    <span
      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: "#EF4444", minWidth: 18, textAlign: "center" }}
      aria-label={`${count} action(s) en attente`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
