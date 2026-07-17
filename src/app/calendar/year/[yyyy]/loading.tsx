export default function YearLoading() {
  // Skeleton shown instantly on navigation while the year's overlap heatmap
  // streams in — 12 month-grid placeholders, matching the heatmap layout.
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-10 bg-white/[0.06] animate-pulse" />
          <div className="grid grid-cols-7 gap-[3px]">
            {Array.from({ length: 35 }).map((_, j) => (
              <div key={j} className="aspect-square bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
