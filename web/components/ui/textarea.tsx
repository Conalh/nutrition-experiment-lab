"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[70px] w-full resize-y rounded-sm border border-line bg-surface-3 px-2.5 py-2",
        "text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-4",
        "transition-colors duration-(--duration-swift) ease-(--ease-instrument)",
        "focus:border-line-3",
        className,
      )}
      {...rest}
    />
  );
});
