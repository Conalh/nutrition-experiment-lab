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
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-dim)",
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span>{value ?? "—"}</span>
      </div>
      <div
        style={{
          background: "var(--surface-2)",
          borderRadius: 6,
          height: 18,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct(value)}%`,
            height: "100%",
            background: color,
            transition: "width .3s",
          }}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--border)",
        borderRadius: 10,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <strong>
          {c.name}
          {c.is_primary && (
            <span style={{ color: "var(--accent)", marginLeft: 8, fontSize: 12 }}>
              PRIMARY
            </span>
          )}
        </strong>
        <Badge tone={resultTone(c.result)}>{c.result}</Badge>
      </div>
      <Bar label="Baseline" value={c.baseline_mean} color="var(--text-dim)" />
      <Bar
        label="Intervention"
        value={c.intervention_mean}
        color="var(--accent)"
      />
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>
        {c.absolute_change != null && (
          <>
            Change: {c.absolute_change > 0 ? "+" : ""}
            {c.absolute_change}
            {c.percent_change != null && ` (${c.percent_change > 0 ? "+" : ""}${c.percent_change}%)`}
            {" · "}
          </>
        )}
        n = {c.baseline_n} baseline / {c.intervention_n} intervention
      </div>
    </div>
  );
}
