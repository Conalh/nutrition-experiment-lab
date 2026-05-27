"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Slot before the input — usually an icon. */
  prefix?: React.ReactNode;
  /** Slot after the input — usually a unit like `kg`. */
  suffix?: React.ReactNode;
  /** Use mono numerics. */
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, mono, className, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-sm border border-line bg-surface-3 px-2.5",
        "transition-colors duration-(--duration-swift) ease-(--ease-instrument)",
        "focus-within:border-line-3",
        className,
      )}
    >
      {prefix && <span className="text-ink-3">{prefix}</span>}
      <input
        ref={ref}
        className={cn(
          "h-9 min-w-0 flex-1 border-0 bg-transparent py-2 text-[14px] text-ink",
          "outline-none placeholder:text-ink-4",
          mono && "font-mono tabular-nums",
        )}
        {...rest}
      />
      {suffix && <span className="shrink-0 text-[12px] text-ink-3">{suffix}</span>}
    </div>
  );
});
