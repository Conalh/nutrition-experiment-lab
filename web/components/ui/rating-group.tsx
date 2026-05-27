"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface RatingGroupProps {
  value: number | null;
  onChange?: (value: number) => void;
  /** Scale upper bound; default 5. Lower bound is always 1. */
  scale?: number;
  /** Optional micro-labels under each number (e.g. ["none","low","mid","high","peak"]). */
  labels?: string[];
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
  /** Accessibility group label, e.g. "Hunger rating, 1 to 5". */
  ariaLabel?: string;
}

const sizes = { sm: "h-7", md: "h-9", lg: "h-11" } as const;

/** 1–5 rating, mono numerals, signal-amber when active. The fundamental
 *  daily-log atom. Press 1–5 on keyboard while group is focused. */
export function RatingGroup({
  value, onChange, scale = 5, labels, size = "md", readonly, ariaLabel,
}: RatingGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1"
      onKeyDown={(e) => {
        if (readonly) return;
        const n = Number(e.key);
        if (n >= 1 && n <= scale) {
          e.preventDefault();
          onChange?.(n);
        }
      }}
    >
      {Array.from({ length: scale }, (_, i) => {
        const n = i + 1;
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={readonly}
            onClick={() => onChange?.(n)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-sm border font-mono text-[13px] font-medium tabular-nums",
              "transition-[background-color,border-color,color] duration-(--duration-swift) ease-(--ease-instrument)",
              sizes[size],
              active
                ? "border-signal bg-signal text-on-signal"
                : "border-line bg-surface-3 text-ink-2 hover:border-line-2 hover:text-ink",
              readonly && "cursor-default hover:border-line hover:text-ink-2",
            )}
            style={{ minWidth: size === "lg" ? 44 : size === "md" ? 36 : 28 }}
          >
            <span>{n}</span>
            {labels?.[i] && (
              <span
                className={cn(
                  "mt-0.5 font-ui text-[9px] uppercase tracking-[0.04em]",
                  active ? "text-[rgba(26,20,8,0.7)]" : "text-ink-4",
                )}
              >
                {labels[i]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
