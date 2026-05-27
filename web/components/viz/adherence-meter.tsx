import { cn } from "@/lib/cn";

interface AdherenceMeterProps {
  /** 0–100 inclusive. */
  pct: number;
  size?: number;
  label?: string;
  className?: string;
}

/** Radial adherence dial — circumference fills clockwise in signal amber. */
export function AdherenceMeter({ pct, size = 80, label = "Adherence", className }: AdherenceMeterProps) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={3} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth={3}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="butt"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[18px] font-medium leading-none tabular-nums tracking-tight text-ink">
            {pct}
            <span className="text-[10px] text-ink-3">%</span>
          </span>
        </div>
      </div>
      <span className="label">{label}</span>
    </div>
  );
}
