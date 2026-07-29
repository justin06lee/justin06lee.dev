"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heatmap } from "@/components/chrome/heatmap";

type Props = {
  year: number;
  heatmap: Record<string, number>;
  today: string;
};

// heatmap value is a 0..1 fill ratio (plan followed out of a normalized day
// target — planned minutes clamped to [4h, 8h]), so it reads as "how much of a
// full day was spent on-plan" rather than a literal fraction of the plan.
function fmtFillRatio(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}% of a full day on plan`;
}

export default function YearView({ year, heatmap, today }: Props) {
  const router = useRouter();
  return (
    <Heatmap
      values={heatmap}
      year={year}
      today={today}
      // Values are 0..1 fill ratios. Bucket against a ceiling slightly above 1
      // (not the brightest day present) so the top/near-white step is reserved
      // for genuinely strong days (~85%+ of a full day on-plan) instead of
      // every followed day maxing out. Keeps the grid from becoming a wall of
      // white while still letting a great day light up fully.
      max={1.15}
      onSelectDay={(date) => router.push(`/calendar/day/${date}`)}
      title={(date, value) => `${date} — ${fmtFillRatio(value)}${date === today ? " (today)" : ""}`}
      // Each month label links to that month's view; next/link keeps it
      // client-side. index is 0-based, so +1 for the "YYYY-MM" token.
      monthHref={({ index }) => `/calendar/month/${year}-${String(index + 1).padStart(2, "0")}`}
      linkComponent={Link}
    />
  );
}
