"use client";

import type { OutcomeComparison } from "@/lib/api";
import { Badge, resultTone } from "./ui";

/** Simple baseline-vs-intervention bar comparison, no chart library. */
export function OutcomeChart({ c }: { c: OutcomeComparison }) {
  const max = Math.max(
    c.baseline_mean ?? 0,
    c.intervention_mean ?? 0,
    c.kind === "rating" ? 5 : 1,
  );
  const pct = (v: number | null) => (v == null ? 0 : (v / max) * 100);

  const Bar = ({
    label,
    value,
    color,
  }: {
    label: string;
    value: number | null;
    color: string;
  }) => (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{value ?? "—"}</span>
      </div>
      <div className="h-[18px] overflow-hidden rounded-md bg-surface">
        <div
          className={`h-full transition-[width] duration-300 ${color}`}
          style={{ width: `${pct(value)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="mb-2.5 rounded-[10px] border border-line p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <strong>
          {c.name}
          {c.is_primary && (
            <span className="ml-2 text-xs text-accent">PRIMARY</span>
          )}
        </strong>
        <Badge tone={resultTone(c.result)}>{c.result}</Badge>
      </div>
      <Bar label="Baseline" value={c.baseline_mean} color="bg-muted" />
      <Bar label="Intervention" value={c.intervention_mean} color="bg-accent" />
      <div className="mt-1.5 text-xs text-muted">
        {c.absolute_change != null && (
          <>
            Change: {c.absolute_change > 0 ? "+" : ""}
            {c.absolute_change}
            {c.percent_change != null &&
              ` (${c.percent_change > 0 ? "+" : ""}${c.percent_change}%)`}
            {" · "}
          </>
        )}
        n = {c.baseline_n} baseline / {c.intervention_n} intervention
      </div>
    </div>
  );
}
