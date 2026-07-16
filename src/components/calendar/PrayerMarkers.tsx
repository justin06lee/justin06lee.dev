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
