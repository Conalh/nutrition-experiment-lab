import { cn } from "@/lib/cn";

interface DotStripProps {
  baseline: number[];
  intervention: number[];
  scaleMin?: number;
  scaleMax?: number;
  width?: number;
  height?: number;
  className?: string;
}

/** Honest distribution view — every daily reading as a dot. Baseline on
 *  top, intervention on bottom, mean indicator as a vertical tick. */
export function DotStrip({
  baseline, intervention,
  scaleMin = 1, scaleMax = 5,
  width = 280, height = 80,
  className,
}: DotStripProps) {
  const pct = (v: number) => ((v - scaleMin) / (scaleMax - scaleMin)) * 100;
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const baseMean = mean(baseline);
  const intMean = mean(intervention);

  return (
    <div className={cn("relative", className)} style={{ width, height }}>
      <Row data={baseline}     m={baseMean} color="var(--color-ink-2)"  label="Baseline" pct={pct} top />
      <Row data={intervention} m={intMean}  color="var(--color-signal)" label="Interv."  pct={pct} />
    </div>
  );
}

interface RowProps {
  data: number[];
  m: number;
  color: string;
  label: string;
  pct: (v: number) => number;
  top?: boolean;
}

function Row({ data, m, color, label, pct, top }: RowProps) {
  return (
    <div className="relative h-1/2 pt-1">
      <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
      {data.map((v, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(v)}%`, background: color, opacity: 0.55 }}
        />
      ))}
      <span
        aria-hidden
        className="absolute top-1/2 h-[18px] w-px -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pct(m)}%`, background: color }}
      />
      <span
        className="label absolute left-0 top-0"
        style={{ marginTop: top ? 0 : 0 }}
      >
        {label}{" "}
        <span className="ml-1 font-mono text-ink-2">{m.toFixed(2)}</span>
      </span>
    </div>
  );
}
