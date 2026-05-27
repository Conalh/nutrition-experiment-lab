"use client";

import React from "react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-muted">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
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
    <div className="rounded-xl border border-bad/40 bg-bad-soft px-4 py-3 text-sm text-bad">
      <div>{message}</div>
      {hint && <div className="mt-1 text-xs text-bad/80">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line py-12 text-center">
      <div className="font-medium text-ink">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
