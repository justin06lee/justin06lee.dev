export default function MonthLoading() {
  // Skeleton shown instantly on navigation (prefetched) while the month's tasks
  // + heatmap stream in — matches the fillHeight agenda grid's footprint.
  return (
    <div className="h-[calc(100dvh-12rem)]">
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-6" />
        ))}
      </div>
      <div className="mt-[3px] grid grid-cols-7 auto-rows-fr gap-[3px] h-[calc(100%-1.5rem)]">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
