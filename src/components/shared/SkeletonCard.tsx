export function SkeletonCard() {
  return (
    <div className="border border-mk-line rounded-lg p-4">
      <div className="aspect-square skeleton-shimmer rounded-lg mb-3" />
      <div className="h-3 skeleton-shimmer rounded w-1/3 mb-2" />
      <div className="h-4 skeleton-shimmer rounded w-full mb-1" />
      <div className="h-4 skeleton-shimmer rounded w-2/3 mb-3" />
      <div className="h-5 skeleton-shimmer rounded w-1/2 mb-3" />
      <div className="h-8 skeleton-shimmer rounded w-full" />
    </div>
  );
}

export function SkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
