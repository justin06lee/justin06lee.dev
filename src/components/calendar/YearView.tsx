"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heatmap } from "@/components/chrome/heatmap";

type Props = {
  year: number;
  heatmap: Record<string, number>;
  today: string;
};

// heatmap value is a 0..1 fill ratio (plan followed out of min(8h, planned))
function fmtFillRatio(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}% on plan`;
}

export default function YearView({ year, heatmap, today }: Props) {
  const router = useRouter();
  return (
    <Heatmap
      values={heatmap}
      year={year}
      today={today}
      // Values are 0..1 fill ratios: cap bucketing at 1 so a fully-followed day
      // is max intensity regardless of the brightest day actually present.
      max={1}
      onSelectDay={(date) => router.push(`/calendar/day/${date}`)}
      title={(date, value) => `${date} — ${fmtFillRatio(value)}${date === today ? " (today)" : ""}`}
      // Each month label links to that month's view; next/link keeps it
      // client-side. index is 0-based, so +1 for the "YYYY-MM" token.
      monthHref={({ index }) => `/calendar/month/${year}-${String(index + 1).padStart(2, "0")}`}
      linkComponent={Link}
    />
  );
}
