"use client";

import Link from "next/link";
import type { Experiment } from "@/lib/api";
import { Badge, Card } from "./ui";

function currentPhase(exp: Experiment): string {
  if (exp.status === "draft") return "Not started";
  if (exp.status === "completed") return "Review";
  if (exp.status === "abandoned") return "Stopped";
  const today = new Date().toISOString().slice(0, 10);
  const within = (s: string | null, e: string | null) =>
    s && e && today >= s && today <= e;
  if (within(exp.baseline_start, exp.baseline_end)) return "Baseline";
  if (within(exp.washout_start, exp.washout_end)) return "Washout";
  if (within(exp.intervention_start, exp.intervention_end))
    return "Intervention";
  return "Between phases";
}

const STATUS_TONE: Record<
  string,
  "neutral" | "good" | "warn" | "bad" | "accent"
> = {
  draft: "neutral",
  active: "accent",
  paused: "warn",
  completed: "good",
  abandoned: "bad",
};

export function ExperimentCard({ exp }: { exp: Experiment }) {
  return (
    <Link href={`/experiments/${exp.id}`} style={{ display: "block" }}>
      <Card
        style={{
          marginBottom: 12,
          transition: "border-color .15s",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
              {exp.title}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
              {exp.question}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Badge tone="neutral">{currentPhase(exp)}</Badge>
            <Badge tone={STATUS_TONE[exp.status] ?? "neutral"}>
              {exp.status}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
