"use client";

import { Loader2 } from "lucide-react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-6 py-12 text-ink-3">
      <Loader2 className="size-4 animate-spin" />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-sm border border-worsened-line bg-worsened-soft px-4 py-3 text-[13px] text-worsened">
      <div>{message}</div>
      {hint && <div className="mt-1 text-[12px] opacity-80">{hint}</div>}
    </div>
  );
}
