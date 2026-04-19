import { db, initDb } from "./db";
import { getSiteConfig, type PrayerLocation } from "./site-config";

export type PrayerTimes = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

type AladhanDay = {
  date: { gregorian: { day: string } };
  timings: Record<string, string>;
};

type AladhanResponse = { code: number; status: string; data: AladhanDay[] };

function cacheKey(year: number, month: number, loc: PrayerLocation): string {
  const hasCoords = loc.latitude !== null && loc.longitude !== null;
  const where = hasCoords ? `${loc.latitude!.toFixed(4)},${loc.longitude!.toFixed(4)}` : `${loc.city}|${loc.country}`;
  return `${year}-${String(month).padStart(2, "0")}|${where}|${loc.method}`;
}

/** Strips " (XXX)" timezone suffix and anything past "HH:MM". */
function trimTime(t: string): string {
  const match = /^(\d{2}:\d{2})/.exec(t);
  return match ? match[1] : t;
}

function normalizeAladhanMonth(days: AladhanDay[]): Record<string, PrayerTimes> {
  const out: Record<string, PrayerTimes> = {};
  for (const d of days) {
    const day = d.date.gregorian.day.padStart(2, "0");
    out[day] = {
      Fajr: trimTime(d.timings.Fajr),
      Dhuhr: trimTime(d.timings.Dhuhr),
      Asr: trimTime(d.timings.Asr),
      Maghrib: trimTime(d.timings.Maghrib),
      Isha: trimTime(d.timings.Isha),
    };
  }
  return out;
}

async function fetchAladhanMonth(
  year: number,
  month: number,
  loc: PrayerLocation,
): Promise<Record<string, PrayerTimes>> {
  const hasCoords = loc.latitude !== null && loc.longitude !== null;
  const url = hasCoords
    ? new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`)
    : new URL(`https://api.aladhan.com/v1/calendarByCity/${year}/${month}`);
  if (hasCoords) {
    url.searchParams.set("latitude", String(loc.latitude));
    url.searchParams.set("longitude", String(loc.longitude));
  } else {
    url.searchParams.set("city", loc.city);
    url.searchParams.set("country", loc.country);
  }
  url.searchParams.set("method", String(loc.method));
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Aladhan HTTP ${res.status} for ${url.toString()}`);
  const json = (await res.json()) as AladhanResponse;
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error(`Aladhan bad payload: ${json.status}`);
  }
  return normalizeAladhanMonth(json.data);
}

export async function getPrayerTimesForDate(date: string): Promise<PrayerTimes | null> {
  const [yStr, mStr, dStr] = date.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = dStr;
  const config = await getSiteConfig();
  const loc = config.prayerLocation;
  const hasCoords = loc.latitude !== null && loc.longitude !== null;
  const hasCity = Boolean(loc.city && loc.country);
  if (!hasCoords && !hasCity) return null;

  await initDb();
  const key = cacheKey(year, month, loc);

  const cached = await db.execute({
    sql: "SELECT data FROM prayer_times_cache WHERE cache_key = ?",
    args: [key],
  });
  const cachedRow = cached.rows[0] as unknown as { data: string } | undefined;
  if (cachedRow) {
    try {
      const parsed = JSON.parse(cachedRow.data) as Record<string, PrayerTimes>;
      return parsed[day] ?? null;
    } catch {
      // fall through to refetch
    }
  }

  try {
    const monthMap = await fetchAladhanMonth(year, month, loc);
    await db.execute({
      sql: `INSERT OR REPLACE INTO prayer_times_cache
            (cache_key, year, month, city, country, method, data, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [key, year, month, loc.city, loc.country, loc.method, JSON.stringify(monthMap), Date.now()],
    });
    return monthMap[day] ?? null;
  } catch (err) {
    console.error("[prayer-times] fetch failed:", err);
    return null;
  }
}
