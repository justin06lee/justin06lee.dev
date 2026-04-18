import { hhmmToMinutes } from "./date-utils";

export default function PrayerTimeMarker({
  name,
  time,
}: {
  name: string;
  time: string;
}) {
  const minutes = hhmmToMinutes(time);
  if (minutes == null) return null;
  const top = (minutes / 1440) * 100;
  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none"
      style={{ top: `${top}%` }}
    >
      <div className="h-px flex-1 bg-white/40" />
      <div className="ml-2 font-mono text-[10px] uppercase tracking-widest text-white/70 whitespace-nowrap">
        {name} {time}
      </div>
    </div>
  );
}
