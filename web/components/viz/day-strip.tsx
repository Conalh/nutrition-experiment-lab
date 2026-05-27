import { cn } from "@/lib/cn";

export interface DayCell {
  /** baseline | washout | intervention | future — drives background. */
  kind: "baseline" | "washout" | "intervention" | "future";
  /** Has the user logged this day? */
  logged?: boolean;
  /** Adherence on this day, if intervention. */
  adh?: "yes" | "partial" | "no" | "na";
}

interface DayStripProps {
  days: DayCell[];
  height?: number;
  className?: string;
}

/** Calendar strip across the top of the daily log. Each day is a tile
 *  colored by window; logged days show an adherence-coloured dot. */
export function DayStrip({ days, height = 22, className }: DayStripProps) {
  return (
    <div className={cn("flex items-stretch gap-0.5", className)} style={{ height }}>
      {days.map((d, i) => {
        const bg =
          d.kind === "baseline"     ? "bg-surface-3" :
          d.kind === "washout"      ? "bg-surface" :
          d.kind === "intervention" ? "bg-signal-soft" :
          "bg-transparent";
        const border =
          d.kind === "future" ? "border border-dashed border-line-2" : "border border-line";
        const adhColor =
          !d.logged              ? "transparent" :
          d.adh === "yes"        ? "var(--color-improved)" :
          d.adh === "partial"    ? "var(--color-signal)" :
          d.adh === "no"         ? "var(--color-worsened)" :
                                   "var(--color-ink-3)";
        return (
          <div
            key={i}
            className={cn("relative min-w-[6px] flex-1", bg, border)}
            aria-label={`Day ${i + 1}, ${d.kind}`}
          >
            {d.logged && (
              <span
                aria-hidden
                className="absolute bottom-[3px] left-1/2 size-1 -translate-x-1/2 rounded-full"
                style={{ background: adhColor }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
