/**
 * Tableau drag-and-drop générique pour la curation home (marques / produits).
 * Utilise @dnd-kit. Le composant est headless : la consommation passe une
 * fonction `renderCells(item, index)` qui retourne les <TableCell> métier.
 *
 * Quand l'ordre change, on appelle `onReorder(newIds)` (les IDs de
 * `home_featured_*`, dans le nouvel ordre) — à brancher sur le RPC
 * `admin_reorder_home_featured`.
 */
import { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Identified = { id: string };

interface SortableRowProps<T extends Identified> {
  item: T;
  index: number;
  renderCells: (item: T, index: number) => ReactNode;
}

function SortableRow<T extends Identified>({ item, index, renderCells }: SortableRowProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <TableRow ref={setNodeRef} style={style} className={cn(isDragging && "bg-muted/30")}>
      <TableCell className="w-10 align-middle">
        <button
          type="button"
          aria-label="Glisser pour réordonner"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      {renderCells(item, index)}
    </TableRow>
  );
}

interface HomeFeaturedSortableTableProps<T extends Identified> {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderCells: (item: T, index: number) => ReactNode;
}

export function HomeFeaturedSortableTable<T extends Identified>({
  items,
  onReorder,
  renderCells,
}: HomeFeaturedSortableTableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    onReorder(next.map((i) => i.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={item.id} item={item} index={index} renderCells={renderCells} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
