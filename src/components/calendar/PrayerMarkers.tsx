import { getPrayerTimesForDate } from "@/lib/prayer-times";
import PrayerTimeMarker from "./PrayerTimeMarker";

/**
 * Async server component that fetches prayer times for a date and renders
 * the markers. Wrap in <Suspense> at the page level so the rest of the day
 * view isn't blocked on this (potentially slow) fetch.
 */
export default async function PrayerMarkers({ date }: { date: string }) {
  const prayers = await getPrayerTimesForDate(date);
  if (!prayers) {
    return (
      <div className="absolute top-2 right-2 text-[10px] text-white/40 font-mono uppercase tracking-widest">
        prayer times unavailable
      </div>
    );
  }
  const markers: [string, string][] = [
    ["Fajr", prayers.Fajr],
    ["Dhuhr", prayers.Dhuhr],
    ["Asr", prayers.Asr],
    ["Maghrib", prayers.Maghrib],
    ["Isha", prayers.Isha],
  ];
  // Single wrapper, not a fragment: this is handed to DayView as the
  // `prayersSlot` prop, and a multi-child fragment passed through a prop gets
  // flattened into a keyless child list at the boundary. The wrapper overlays
  // the plan column (absolute inset-0) so each marker's top% still resolves
  // against the same box.
  return (
    <div className="absolute inset-0 pointer-events-none">
      {markers.map(([name, time]) => (
        <PrayerTimeMarker key={name} name={name} time={time} />
      ))}
    </div>
  );
}
