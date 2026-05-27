import { cn } from "@/lib/cn";

interface ConfidenceMeterProps {
  level: "low" | "med" | "high";
  label?: string;
  score?: number;
  width?: number;
  className?: string;
}

/** 3-tier confidence indicator. Tone follows level. */
export function ConfidenceMeter({
  level, label = "Confidence", score, width = 140, className,
}: ConfidenceMeterProps) {
  const tiers = ["low", "med", "high"] as const;
  const idx = tiers.indexOf(level);
  const toneClass =
    level === "high" ? "text-improved" :
    level === "med"  ? "text-signal-ink" :
                       "text-worsened";
  const bgClass =
    level === "high" ? "bg-improved" :
    level === "med"  ? "bg-signal" :
                       "bg-worsened";

  return (
    <div className={cn("flex flex-col gap-1.5", className)} style={{ width }}>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className={cn("font-mono text-[11px] font-medium uppercase tracking-(--tracking-label)", toneClass)}>
          {level}
        </span>
      </div>
      <div className="flex h-1.5 gap-0.5">
        {tiers.map((t, i) => (
          <div
            key={t}
            className={cn(
              "flex-1 rounded-sm",
              i <= idx ? bgClass : "bg-surface-3",
              i <= idx && "opacity-90",
            )}
          />
        ))}
      </div>
      {score != null && (
        <span className="font-mono text-[10px] text-ink-4">score {score}/100</span>
      )}
    </div>
  );
}
