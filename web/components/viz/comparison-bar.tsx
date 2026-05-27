import { cn } from "@/lib/cn";

interface WindowData {
  mean: number;
  /** Half-width of the 95% CI. */
  ci: number;
  n: number;
}

interface ComparisonBarProps {
  metric: React.ReactNode;
  scaleMin?: number;
  scaleMax?: number;
  baseline: WindowData;
  intervention: WindowData;
  /** Which direction counts as "improved" for tone coloring. */
  direction?: "higher" | "lower" | "observe";
  /** Optional unit shown alongside the metric name. */
  unit?: string;
  /** Reduces row gap for stacking many bars on one screen. */
  compact?: boolean;
  className?: string;
}

/** Primary baseline-vs-intervention visualization. Two horizontal bars
 *  with mean dots, dashed CI whiskers, and an integer tick scale below.
 *  Direction-aware tone for the delta. */
export function ComparisonBar({
  metric, scaleMin = 1, scaleMax = 5, baseline, intervention, direction = "higher", unit, compact, className,
}: ComparisonBarProps) {
  const range = scaleMax - scaleMin;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - scaleMin) / range) * 100));
  const delta = intervention.mean - baseline.mean;
  const tone: "improved" | "worsened" | "neutral" =
    Math.abs(delta) < 0.15 ? "neutral" :
    direction === "higher" ? (delta > 0 ? "improved" : "worsened") :
    direction === "lower"  ? (delta < 0 ? "improved" : "worsened") :
    "neutral";
  const toneVar =
    tone === "improved" ? "var(--color-improved)" :
    tone === "worsened" ? "var(--color-worsened)" :
    "var(--color-neutral)";

  const ticks: number[] = [];
  for (let v = scaleMin; v <= scaleMax; v++) ticks.push(v);

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2.5", className)}>
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[18px] tracking-tight text-ink">{metric}</span>
          <span className="label text-ink-4">
            {direction === "higher" ? "↑ goal" : direction === "lower" ? "↓ goal" : "◇ observe"}
            {unit && ` · ${unit}`}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 font-mono text-[14px] font-medium tabular-nums"
          style={{ color: toneVar }}
        >
          {delta > 0 ? "+" : ""}{delta.toFixed(2)}
          <span className="text-[10px] text-ink-4">Δ</span>
        </span>
      </div>

      {/* Two bars */}
      <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
        <Row label="Baseline" data={baseline} pct={pct} toneVar="var(--color-ink-3)" filled={false} />
        <Row label="Interv."   data={intervention} pct={pct} toneVar={toneVar} filled />
      </div>

      {/* Scale */}
      <div className="mt-0.5 flex items-center gap-3">
        <div className="w-20" />
        <div className="relative h-2.5 flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 -translate-x-1/2 font-mono text-[9px] text-ink-4"
              style={{ left: `${pct(t)}%` }}
            >
              <div className="mx-auto mb-px h-[3px] w-px bg-line-2" />
              {t}
            </div>
          ))}
        </div>
        <div className="w-10" />
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  data: WindowData;
  pct: (v: number) => number;
  toneVar: string;
  filled: boolean;
}

function Row({ label, data, pct, toneVar, filled }: RowProps) {
  const meanX = pct(data.mean);
  const ciLeft = pct(Math.max(-Infinity, data.mean - data.ci));
  const ciRight = pct(Math.min(Infinity, data.mean + data.ci));

  return (
    <div className="flex items-center gap-3">
      <div className="flex w-20 flex-col">
        <span className="text-[10px] uppercase tracking-(--tracking-label) text-ink-3">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink">
          {data.mean.toFixed(2)}
          <span className="ml-1 text-[10px] text-ink-4">± {data.ci.toFixed(2)}</span>
        </span>
      </div>

      <div className="relative h-5 flex-1">
        {/* base track */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        {/* bar 0 → mean */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-[1px]"
          style={{
            width: `${meanX}%`,
            background: filled ? toneVar : "var(--color-ink-3)",
            opacity: filled ? 0.9 : 0.5,
          }}
        />
        {/* whisker top/bottom (dashed CI band) */}
        <div
          className="absolute top-1/2 h-3.5 -translate-y-1/2 opacity-55"
          style={{
            left: `${ciLeft}%`,
            width: `${ciRight - ciLeft}%`,
            borderTop: `1px dashed ${toneVar}`,
            borderBottom: `1px dashed ${toneVar}`,
          }}
        />
        {/* whisker end caps */}
        <CapLine left={ciLeft}  color={toneVar} />
        <CapLine left={ciRight} color={toneVar} />
        {/* mean dot */}
        <div
          className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-bg"
          style={{ left: `calc(${meanX}% - 5px)`, border: `1.5px solid ${toneVar}` }}
        />
      </div>

      <div className="w-10 text-right font-mono text-[10px] tabular-nums text-ink-4">n={data.n}</div>
    </div>
  );
}

function CapLine({ left, color }: { left: number; color: string }) {
  return (
    <div
      className="absolute top-1/2 h-3.5 w-px -translate-y-1/2"
      style={{ left: `calc(${left}% - 0.5px)`, background: color }}
    />
  );
}
