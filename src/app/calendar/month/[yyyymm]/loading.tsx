export default function MonthLoading() {
  // Skeleton shown instantly on navigation while the month's tasks + heatmap
  // stream in — matches the square-cell month grid footprint.
  return (
    <div>
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-6" />
        ))}
      </div>
      <div className="mt-[3px] grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square border border-white/10 bg-white/[0.02] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
