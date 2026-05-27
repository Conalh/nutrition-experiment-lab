import { cn } from "@/lib/cn";
import { ArrowUp, ArrowDown, Circle } from "lucide-react";

type Tone = "improved" | "worsened" | "signal" | "neutral";

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** Delta as a signed number. Renders with arrow + sign. */
  delta?: number;
  deltaUnit?: string;
  tone?: Tone;
  sub?: React.ReactNode;
  className?: string;
}

const toneClass: Record<Tone, string> = {
  improved: "text-improved",
  worsened: "text-worsened",
  signal:   "text-signal-ink",
  neutral:  "text-ink-2",
};

/** Labelled mono-numeric statistic. The dashboard stat strip and the
 *  finding banner both compose Stats. */
export function Stat({ label, value, unit, delta, deltaUnit, tone = "neutral", sub, className }: StatProps) {
  const ArrowIcon = delta == null ? Circle : delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Circle;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="label">{label}</span>
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[28px] font-medium tabular-nums leading-none tracking-[-0.03em] text-ink">
          {value}
          {unit && <span className="ml-0.5 text-[14px] text-ink-3">{unit}</span>}
        </span>
        {delta != null && (
          <span className={cn("inline-flex items-center gap-0.5 font-mono text-[12px] font-medium tabular-nums", toneClass[tone])}>
            <ArrowIcon className="size-2.5" />
            {delta > 0 ? "+" : ""}{delta}{deltaUnit}
          </span>
        )}
      </div>
      {sub && <span className="text-[11px] text-ink-3">{sub}</span>}
    </div>
  );
}
