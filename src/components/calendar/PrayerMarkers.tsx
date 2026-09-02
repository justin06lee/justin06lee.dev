import { getPrayerTimesForDate } from "@/lib/prayer-times";
import { hhmmToMinutes } from "@/lib/calendar-dates";
import { TimelineMarker } from "@/components/chrome/timeline";

/**
 * Async server component that fetches prayer times for a date and renders them
 * as chrome Timeline markers. Handed to DayView as the Timeline `markersSlot`
 * and wrapped in <Suspense> at the page level, so a slow Aladhan fetch streams
 * in without blocking the day view.
 */
export default async function PrayerMarkers({ date }: { date: string }) {
  // Suspense isolates a slow fetch's latency but NOT a thrown error — an
  // initDb()/cache hiccup inside getPrayerTimesForDate would otherwise bubble
  // up and blank the whole day page. Swallow it into the same "unavailable"
  // fallback that a null result already renders.
  let prayers: Awaited<ReturnType<typeof getPrayerTimesForDate>> = null;
  try {
    prayers = await getPrayerTimesForDate(date);
  } catch {
    prayers = null;
  }
  if (!prayers) {
    return (
      <div className="absolute top-2 right-2 text-[10px] text-white/40 uppercase tracking-widest">
        prayer times unavailable
      </div>
    );
  }
  // Prayer names lowercased to match the site's lowercase voice; the property
  // access still uses the API's capitalized keys.
  const markers: [string, string][] = [
    ["fajr", prayers.Fajr],
    ["dhuhr", prayers.Dhuhr],
    ["asr", prayers.Asr],
    ["maghrib", prayers.Maghrib],
    ["isha", prayers.Isha],
  ];
  // TimelineMarker resolves its own top% against the full 24h track, so the
  // markers sit correctly once slotted into Timeline's marker layer.
  return (
    <>
      {markers.map(([name, time]) => {
        const minutes = hhmmToMinutes(time);
        if (minutes == null) return null;
        return <TimelineMarker key={name} minutes={minutes} label={`${name} ${time}`} />;
      })}
    </>
  );
}
