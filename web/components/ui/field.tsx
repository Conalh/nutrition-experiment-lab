import * as React from "react";
import { cn } from "@/lib/cn";
import { TriangleAlert } from "lucide-react";

interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Labelled form field. Use as a wrapper around <Input>, <Textarea>,
 *  <Select>, <RatingGroup>, <Segmented>, etc. The label cap follows
 *  the system convention: uppercase, tracked, ink-3. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="flex items-baseline justify-between text-[11px] font-medium uppercase tracking-(--tracking-label) text-ink-3">
          <span>
            {label}
            {required && <span className="ml-1 text-signal">*</span>}
          </span>
          {hint && (
            <span className="text-[11px] normal-case tracking-normal text-ink-4">{hint}</span>
          )}
        </span>
      )}
      {children}
      {error && (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-worsened">
          <TriangleAlert className="size-3" /> {error}
        </span>
      )}
    </label>
  );
}
