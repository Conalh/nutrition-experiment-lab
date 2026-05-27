"use client";

import Link from "next/link";
import type { Experiment } from "@/lib/api";
import { Badge } from "./ui";

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
    <Link href={`/experiments/${exp.id}`} className="block">
      <div className="mb-3 cursor-pointer rounded-xl border border-line bg-card p-[18px] transition hover:border-muted">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-base font-semibold">{exp.title}</div>
            <div className="text-sm text-muted">{exp.question}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Badge tone="neutral">{currentPhase(exp)}</Badge>
            <Badge tone={STATUS_TONE[exp.status] ?? "neutral"}>
              {exp.status}
            </Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
