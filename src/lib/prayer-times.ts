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

// Per-process in-memory cache. Survives across requests served by the same
// worker — avoids the DB read for repeat lookups within the same month/loc.
// Keyed by `${year}-${month}-${loc-hash}`; values are the full month map.
// Bounded so a caller sweeping many months/locations can't grow it without
// limit (Map preserves insertion order, so the first key is the oldest).
const MEM_CACHE_MAX = 64;
const memCache = new Map<string, Record<string, PrayerTimes>>();

function memCacheGet(key: string): Record<string, PrayerTimes> | undefined {
  const hit = memCache.get(key);
  // LRU-ish: re-insert on hit so the actively-used months stay warm and the
  // eviction below drops genuinely cold entries.
  if (hit) {
    memCache.delete(key);
    memCache.set(key, hit);
  }
  return hit;
}

function memCacheSet(key: string, value: Record<string, PrayerTimes>): void {
  memCache.delete(key);
  memCache.set(key, value);
  while (memCache.size > MEM_CACHE_MAX) {
    const oldest = memCache.keys().next().value;
    if (oldest === undefined) break;
    memCache.delete(oldest);
  }
}

// Coalesces concurrent cache misses for the same key onto a single upstream
// fetch. Without this, N simultaneous requests for a fresh month each hit the
// Aladhan API — an unauthenticated request-amplification vector. The promise is
// registered BEFORE it's awaited and removed in a finally, so it only ever
// dedups genuinely in-flight work.
const inFlight = new Map<string, Promise<Record<string, PrayerTimes>>>();

// How long a *current-or-future* month's cached data stays fresh. Past months
// are historical and never change, so they're treated as permanent regardless
// of fetched_at.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

function isPastMonth(year: number, month: number): boolean {
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  return year < curY || (year === curY && month < curM);
}

export async function getPrayerTimesForDate(date: string): Promise<PrayerTimes | null> {
  const [yStr, mStr, dStr] = date.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = dStr.padStart(2, "0");

  // Clamp to the current year ±5 even for otherwise-valid dates: a date far in
  // the past/future should never reach the Aladhan API or spawn a cache entry.
  // This is the last line of defence behind isValidDateString's static bounds.
  const currentYear = new Date().getUTCFullYear();
  if (year < currentYear - 5 || year > currentYear + 5) return null;

  const config = await getSiteConfig();
  const loc = config.prayerLocation;
  const hasCoords = loc.latitude !== null && loc.longitude !== null;
  const hasCity = Boolean(loc.city && loc.country);
  if (!hasCoords && !hasCity) return null;

  const key = cacheKey(year, month, loc);

  // 1) Memory cache — instant.
  const memHit = memCacheGet(key);
  if (memHit) return memHit[day] ?? null;

  // 2) DB cache — one round trip. Honor fetched_at so a stale current/future
  // month is refreshed; past months are permanent.
  await initDb();
  const cached = await db.execute({
    sql: "SELECT data, fetched_at FROM prayer_times_cache WHERE cache_key = ?",
    args: [key],
  });
  const cachedRow = cached.rows[0] as unknown as { data: string; fetched_at: number } | undefined;
  if (cachedRow) {
    const fresh = isPastMonth(year, month) || Date.now() - Number(cachedRow.fetched_at) < CACHE_TTL_MS;
    if (fresh) {
      try {
        const parsed = JSON.parse(cachedRow.data) as Record<string, PrayerTimes>;
        memCacheSet(key, parsed);
        return parsed[day] ?? null;
      } catch {
        // fall through to refetch
      }
    }
  }

  // 3) Aladhan API — slow; populate both caches before returning. Dedup so N
  // concurrent misses share ONE fetch.
  let pending = inFlight.get(key);
  if (!pending) {
    pending = (async () => {
      const monthMap = await fetchAladhanMonth(year, month, loc);
      memCacheSet(key, monthMap);
      await db.execute({
        sql: `INSERT OR REPLACE INTO prayer_times_cache
              (cache_key, year, month, city, country, method, data, fetched_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [key, year, month, loc.city, loc.country, loc.method, JSON.stringify(monthMap), Date.now()],
      });
      return monthMap;
    })();
    inFlight.set(key, pending);
  }

  try {
    const monthMap = await pending;
    return monthMap[day] ?? null;
  } catch (err) {
    console.error("[prayer-times] fetch failed:", err);
    return null;
  } finally {
    inFlight.delete(key);
  }
}
