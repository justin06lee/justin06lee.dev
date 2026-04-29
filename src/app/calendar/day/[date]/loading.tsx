export default function DayLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr_280px] pb-20 md:pb-0">
      <div className="border border-white/10 bg-white/[0.02] min-h-[960px] animate-pulse" />
      <div className="hidden md:block border border-white/10 bg-white/[0.02] min-h-[960px] animate-pulse" />
      <div className="hidden md:block space-y-3">
        <div className="h-8 border border-white/10 bg-white/[0.02] animate-pulse" />
        <div className="h-10 border border-white/10 bg-white/[0.02] animate-pulse" />
        <div className="h-32 border border-white/10 bg-white/[0.02] animate-pulse" />
      </div>
    </div>
  );
}
