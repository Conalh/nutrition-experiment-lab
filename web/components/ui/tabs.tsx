"use client";

import { cn } from "@/lib/cn";

interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: Array<TabOption<T>>;
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, options, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex gap-0 border-b border-line", className)}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center gap-2 border-0 bg-transparent px-3.5 py-2.5 text-[13px] font-medium",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span className="font-mono text-[11px] tabular-nums text-ink-4">{opt.count}</span>
            )}
            {active && (
              <span
                aria-hidden
                className="absolute -bottom-px left-3.5 right-3.5 h-px bg-signal"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
