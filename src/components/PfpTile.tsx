// Profile-picture tile. Now backed by the chrome registry's pfp
// (`@/components/chrome/pfp`) — the 3d-tilt-on-hover tile with a cartoon glint
// sweep, ported from this very component. We adapt the site's `Pfp` config
// shape ({ url, x, y, scale }) to chrome's src/x/y/scale props.
import { Pfp } from "@/components/chrome/pfp";
import type { Pfp as PfpConfig } from "@/lib/site-config";

export default function PfpTile({ pfp }: { pfp: PfpConfig }) {
    return <Pfp src={pfp.url} alt="pfp" x={pfp.x} y={pfp.y} scale={pfp.scale} />;
}
