import { Skeleton } from "@/components/ui/skeleton";

export function OfferSkeletonRow() {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 last:border-b-0">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-14 rounded-md" />
      </div>
    </div>
  );
}
