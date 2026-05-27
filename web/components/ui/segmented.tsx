"use client";

import { cn } from "@/lib/cn";

type Tone = "improved" | "worsened" | "signal" | "info" | "neutral";

interface Option<T extends string> {
  value: T;
  label: string;
  /** Optional dot color to disambiguate options visually. */
  tone?: Tone;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: Array<T | Option<T>>;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const heights = { sm: "h-[26px]", md: "h-[30px]", lg: "h-9" } as const;
const toneDot: Record<Tone, string> = {
  improved: "bg-improved",
  worsened: "bg-worsened",
  signal:   "bg-signal",
  info:     "bg-info",
  neutral:  "bg-neutral",
};

/** Segmented control. For 2–3 options that fit on one line; for more,
 *  reach for <Select>. Adherence picker is the canonical example. */
export function Segmented<T extends string>({
  value, onChange, options, size = "md", className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-0 rounded-sm border border-line-2 bg-surface-3 p-0.5",
        heights[size],
        className,
      )}
    >
      {options.map((opt) => {
        const o: Option<T> = typeof opt === "string" ? { value: opt, label: opt } : opt;
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-3 text-[12px] font-medium font-ui",
              "transition-[background-color,color,box-shadow] duration-(--duration-swift) ease-(--ease-instrument)",
              active ? "bg-surface text-ink shadow-(--shadow-1)" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.tone && (
              <span aria-hidden className={cn("size-1.5 rounded-full", toneDot[o.tone])} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
