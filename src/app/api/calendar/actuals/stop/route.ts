import { NextRequest, NextResponse } from "next/server";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { stopActual, stopActualById, stopAllActuals } from "@/lib/calendar";
import { MAX_TRACK, PRIMARY_TRACK, isValidTrack } from "@/lib/calendar-constants";
import { MAX_TITLE_LEN, isStringWithin } from "@/lib/calendar-validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Empty body keeps the original "stop whatever is running" behaviour.
  }

  // `all` stops every lane at once. It has to be explicit: an omitted track
  // means "the primary lane", never "all lanes", so a client that forgets to
  // send one can't wipe out the user's other running activities.
  if (body.all === true) {
    const { stopped } = await stopAllActuals();
    return NextResponse.json({ stopped });
  }

  // Stopping by id is how multi-lane UIs address a specific running row
  // without having to know which lane it landed on.
  if (body.id !== undefined) {
    if (!isStringWithin(body.id, MAX_TITLE_LEN) || body.id.length === 0) {
      return NextResponse.json({ error: "id must be a non-empty string" }, { status: 400 });
    }
    return NextResponse.json(await stopActualById(body.id));
  }

  if (body.track !== undefined && !isValidTrack(body.track)) {
    return NextResponse.json(
      { error: `track must be an integer between ${PRIMARY_TRACK} and ${MAX_TRACK}` },
      { status: 400 },
    );
  }

  const result = await stopActual(Date.now(), body.track as number | undefined);
  return NextResponse.json(result);
}
