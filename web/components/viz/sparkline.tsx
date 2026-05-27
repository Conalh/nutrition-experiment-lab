import { cn } from "@/lib/cn";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  scaleMin?: number;
  scaleMax?: number;
  /** Inclusive [start, end] day indices to shade as baseline window. */
  baselineRange?: [number, number];
  /** Inclusive [start, end] day indices to shade as intervention window. */
  interventionRange?: [number, number];
  /** Plot a dot for every day's reading. */
  showDots?: boolean;
  /** Draw a dashed mean line for each shaded window. */
  showMeans?: boolean;
  className?: string;
}

/** Full timeline of a single metric across an experiment. Shaded windows
 *  + dashed window-mean lines + per-day dots. Pure SVG. */
export function Sparkline({
  data,
  width = 480,
  height = 64,
  scaleMin = 1,
  scaleMax = 5,
  baselineRange,
  interventionRange,
  showDots,
  showMeans,
  className,
}: SparklineProps) {
  const n = data.length;
  const xAt = (i: number) => (i / Math.max(1, n - 1)) * width;
  const yAt = (v: number) =>
    height - ((v - scaleMin) / (scaleMax - scaleMin)) * (height - 10) - 5;

  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");

  const windowMean = (range: [number, number]) =>
    data.slice(range[0], range[1] + 1).reduce((a, b) => a + b, 0) /
    (range[1] - range[0] + 1);

  const baseMean = baselineRange ? windowMean(baselineRange) : null;
  const intMean = interventionRange ? windowMean(interventionRange) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block overflow-visible", className)}
      aria-hidden
    >
      {baselineRange && (
        <rect
          x={xAt(baselineRange[0])}
          y={0}
          width={xAt(baselineRange[1]) - xAt(baselineRange[0])}
          height={height}
          fill="var(--color-ink)"
          opacity={0.04}
        />
      )}
      {interventionRange && (
        <rect
          x={xAt(interventionRange[0])}
          y={0}
          width={xAt(interventionRange[1]) - xAt(interventionRange[0])}
          height={height}
          fill="var(--color-signal)"
          opacity={0.08}
        />
      )}
      {showMeans && baselineRange && baseMean != null && (
        <line
          x1={xAt(baselineRange[0])}
          y1={yAt(baseMean)}
          x2={xAt(baselineRange[1])}
          y2={yAt(baseMean)}
          stroke="var(--color-ink-3)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}
      {showMeans && interventionRange && intMean != null && (
        <line
          x1={xAt(interventionRange[0])}
          y1={yAt(intMean)}
          x2={xAt(interventionRange[1])}
          y2={yAt(intMean)}
          stroke="var(--color-signal)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="var(--color-ink-2)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDots &&
        data.map((v, i) => {
          const inInt =
            interventionRange && i >= interventionRange[0] && i <= interventionRange[1];
          return (
            <circle
              key={i}
              cx={xAt(i)}
              cy={yAt(v)}
              r={1.8}
              fill={inInt ? "var(--color-signal)" : "var(--color-ink-2)"}
            />
          );
        })}
    </svg>
  );
}
