// Spinning ASCII donut. Now backed by the chrome registry's donut
// (`@/components/chrome/donut`), the off-thread-baked port of this component.
// This thin adapter preserves the site's historical defaults (speed 0.75,
// fixed K=120) so existing call sites render identically; every prop still
// forwards through to <Donut>.
import { Donut, type DonutProps } from "@/components/chrome/donut";

export type AsciiSpinningDonutProps = DonutProps;

export default function AsciiSpinningDonut(props: AsciiSpinningDonutProps) {
    return <Donut width={60} height={30} R={0.4} r={0.25} K={120} D={4} speed={0.75} {...props} />;
}
