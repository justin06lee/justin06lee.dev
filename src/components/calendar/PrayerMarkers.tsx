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
  return (
    <>
      <PrayerTimeMarker name="Fajr" time={prayers.Fajr} />
      <PrayerTimeMarker name="Dhuhr" time={prayers.Dhuhr} />
      <PrayerTimeMarker name="Asr" time={prayers.Asr} />
      <PrayerTimeMarker name="Maghrib" time={prayers.Maghrib} />
      <PrayerTimeMarker name="Isha" time={prayers.Isha} />
    </>
  );
}
