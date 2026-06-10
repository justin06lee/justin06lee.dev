import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (!lat || !lon || !/^-?\d+(\.\d+)?$/.test(lat) || !/^-?\d+(\.\d+)?$/.test(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  // reject out-of-range coordinates before hitting nominatim; the format regex
  // above alone would let through values like lat=181 or lon=-200.
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ error: "lat and lon must be valid coordinates" }, { status: 400 });
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en&zoom=10`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "justin06lee.dev calendar (contact: tenet.sh@gmail.com)" },
    });
    if (!res.ok) return NextResponse.json({ error: `Nominatim HTTP ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { address?: NominatimAddress };
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state || "";
    const country = (a.country_code || "").toUpperCase() || a.country || "";
    if (!city || !country) {
      return NextResponse.json({ error: "No city/country in reverse geocode" }, { status: 404 });
    }
    return NextResponse.json({ city, country });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reverse geocode failed" }, { status: 502 });
  }
}
