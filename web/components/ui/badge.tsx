import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "improved" | "worsened" | "signal" | "info" | "ghost";
type Size = "sm" | "md" | "lg";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  /** Solid dot prefix in the tone color. */
  dot?: boolean;
  /** Icon component (e.g. ArrowUp). */
  icon?: React.ComponentType<{ className?: string }>;
}

const toneClasses: Record<Tone, string> = {
  neutral:  "text-ink-2       bg-neutral-soft  border-neutral-line",
  improved: "text-improved    bg-improved-soft border-improved-line",
  worsened: "text-worsened    bg-worsened-soft border-worsened-line",
  signal:   "text-signal-ink  bg-signal-soft   border-signal-line",
  info:     "text-info        bg-info-soft     border-info-line",
  ghost:    "text-ink-3       bg-transparent   border-line-2",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-[18px] px-1.5 text-[10px] gap-1",
  md: "h-[22px] px-2   text-[11px] gap-1.5",
  lg: "h-[26px] px-2.5 text-[12px] gap-1.5",
};

const iconSize: Record<Size, string> = {
  sm: "size-[10px]",
  md: "size-[11px]",
  lg: "size-[12px]",
};

/** Status chip. Tone is semantic — use `improved` only for improvements,
 *  `worsened` only for regressions, `signal` for "active" lifecycle. */
export function Badge({ tone = "neutral", size = "md", dot, icon: Icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm border font-medium uppercase tracking-[0.04em] font-ui",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className="size-[6px] rounded-full"
          style={{ background: "currentColor" }}
        />
      )}
      {Icon && <Icon className={iconSize[size]} />}
      {children}
    </span>
  );
}
