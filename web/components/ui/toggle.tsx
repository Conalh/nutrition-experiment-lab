"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  value: boolean;
  onChange?: (next: boolean) => void;
  label?: React.ReactNode;
  /** Accessible label when no visible label is provided. */
  ariaLabel?: string;
}

export function Toggle({ value, onChange, label, ariaLabel }: ToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onClick={() => onChange?.(!value)}
        className={cn(
          "relative h-4 w-7 rounded-full border transition-colors duration-(--duration-swift) ease-(--ease-instrument)",
          value ? "border-signal bg-signal" : "border-line-2 bg-surface-3",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-px size-3 rounded-full transition-[left] duration-(--duration-swift) ease-(--ease-instrument)",
            value ? "left-[13px] bg-on-signal" : "left-px bg-ink-2",
          )}
        />
      </button>
      {label && <span className="text-ink-2">{label}</span>}
    </label>
  );
}
