"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Leaf, Play, Plus, Square, Pause } from "lucide-react";
import {
  api,
  type AnalysisResult,
  type OutcomeComparison,
  type Severity,
} from "@/lib/api";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { KV } from "@/components/ui/kv";
import { ComparisonBar } from "@/components/viz/comparison-bar";
import { ConfidenceMeter } from "@/components/viz/confidence-meter";
import { AdherenceMeter } from "@/components/viz/adherence-meter";
import { Loading, ErrorState } from "@/components/states";

const CONFOUNDER_KINDS = [
  "illness", "travel", "poor_sleep", "alcohol",
  "unusual_training", "high_stress", "missed_log", "other",
];

function dir(d: string): "higher" | "lower" | "observe" {
  return d === "higher_better" ? "higher" : d === "lower_better" ? "lower" : "observe";
}

function findingHeadline(p: OutcomeComparison | undefined): React.ReactNode {
  if (!p || p.baseline_mean == null || p.intervention_mean == null) {
    return "Run the analysis to see your finding.";
  }
  const delta = Math.abs(p.absolute_change ?? 0).toFixed(1);
  const unit = p.kind === "rating" ? " points" : "";
  if (p.result === "improved") {
    const verb = p.direction === "lower_better" ? "fell" : "rose";
    return (
      <>
        {p.name} {verb} by <em className="not-italic text-improved">{delta}{unit}</em> during the intervention window — a meaningful change.
      </>
    );
  }
  if (p.result === "worsened") {
    return (
      <>
        {p.name} moved <em className="not-italic text-worsened">the wrong way</em> during the intervention window.
      </>
    );
  }
  if (p.result === "unchanged") {
    return <>{p.name} didn&apos;t move much between the two windows.</>;
  }
  return <>Not enough clean data to call {p.name} yet.</>;
}

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["experiment", id],
    queryFn: () => api.getExperiment(id),
  });
  const { data: analysis } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api.getAnalysis(id),
    retry: false,
  });
  const { data: confounders } = useQuery({
    queryKey: ["confounders", id],
    queryFn: () => api.listConfounders(id),
  });

  const analyze = useMutation({
    mutationFn: () => api.analyze(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analysis", id] }),
  });
  const lifecycle = useMutation({
    mutationFn: (action: string) => api.lifecycle(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiment", id] });
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });

  const [cfDate, setCfDate] = useState("");
  const [cfKind, setCfKind] = useState("poor_sleep");
  const [cfSeverity, setCfSeverity] = useState<Severity>("medium");
  const [cfNotes, setCfNotes] = useState("");
  const addConfounder = useMutation({
    mutationFn: () => api.addConfounder(id, { date: cfDate, kind: cfKind, severity: cfSeverity, notes: cfNotes || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["confounders", id] });
      setCfDate("");
      setCfNotes("");
    },
  });

  if (isLoading) return (<><TopBar title="Experiment" /><Loading /></>);
  if (error || !data) return (<><TopBar title="Experiment" /><div className="p-10"><ErrorState message="Could not load experiment." /></div></>);

  const { experiment: exp, interventions, outcomes } = data;
  const primary = analysis?.comparisons.find((c) => c.is_primary);

  return (
    <>
      <TopBar
        breadcrumb={["Lab", exp.title]}
        eyebrow={`Status · ${exp.status}`}
        title={exp.title}
        status={<Badge tone={exp.status === "active" ? "signal" : "neutral"} dot>{exp.status}</Badge>}
        actions={
          ["completed", "active", "paused"].includes(exp.status) ? (
            <Link href={`/reports/${id}`}>
              <Button variant="ghost" size="sm" icon={Download}>Report</Button>
            </Link>
          ) : null
        }
      />

      <div className="grid flex-1 items-start gap-6 overflow-y-auto px-8 py-6 max-lg:grid-cols-1" style={{ gridTemplateColumns: "280px 1fr" }}>
        {/* Left rail */}
        <aside className="flex flex-col gap-4">
          <Card eyebrow="Question" padding={16}>
            <p className="m-0 font-display text-[18px] italic leading-[1.4] text-ink">{exp.question}</p>
          </Card>

          <Card eyebrow="Protocol" title="Summary" padding={16}>
            <KV
              rows={[
                ["Baseline", exp.baseline_start ? `${exp.baseline_start} → ${exp.baseline_end}` : "—", { mono: true }],
                ...(exp.washout_start ? [["Washout", `${exp.washout_start} → ${exp.washout_end}`, { mono: true }] as [string, string, { mono: boolean }]] : []),
                ["Intervention", exp.intervention_start ? `${exp.intervention_start} → ${exp.intervention_end}` : "—", { mono: true }],
                ["Outcomes", String(outcomes.length), { mono: true }],
              ]}
            />
            {interventions.map((iv) => (
              <div key={iv.id} className="mt-3 border-t border-line pt-3">
                <div className="text-[13px] font-medium text-ink">{iv.name}</div>
                <div className="mt-0.5 text-[12px] leading-[1.5] text-ink-3">{iv.rule_text}</div>
              </div>
            ))}
          </Card>

          <Card eyebrow="Lifecycle" title="Actions" padding={16}>
            <div className="flex flex-col gap-2">
              {exp.status === "draft" && <Button variant="primary" size="md" full icon={Play} onClick={() => lifecycle.mutate("start")}>Start logging</Button>}
              {exp.status === "active" && <Button variant="secondary" size="md" full icon={Pause} onClick={() => lifecycle.mutate("pause")}>Pause</Button>}
              {exp.status === "paused" && <Button variant="primary" size="md" full icon={Play} onClick={() => lifecycle.mutate("resume")}>Resume</Button>}
              {["active", "paused"].includes(exp.status) && <Button variant="secondary" size="md" full icon={Square} onClick={() => lifecycle.mutate("complete")}>Complete</Button>}
              <Button variant="secondary" size="md" full onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                {analyze.isPending ? "Analyzing…" : "Run analysis"}
              </Button>
            </div>
            {lifecycle.error && <p className="mt-2 text-[12px] text-worsened">{lifecycle.error instanceof Error ? lifecycle.error.message : "Error"}</p>}
          </Card>
        </aside>

        {/* Main */}
        <div className="flex flex-col gap-4">
          {!analysis ? (
            <Card eyebrow="Finding" title="No analysis yet">
              <p className="m-0 text-[13px] text-ink-2">
                Log some days, then run the analysis to get a plain-language finding,
                confidence rating, and a baseline-vs-intervention comparison.
              </p>
              <div className="mt-4">
                <Button variant="primary" size="md" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                  {analyze.isPending ? "Analyzing…" : "Run analysis"}
                </Button>
              </div>
            </Card>
          ) : (
            <Analysis analysis={analysis} primary={primary} recommendation={analysis.recommendation} />
          )}

          {/* Confounders */}
          <Card title="Confounders" eyebrow={`${confounders?.length ?? 0} logged`}>
            <ul className="m-0 flex flex-col gap-0 p-0">
              {(confounders ?? []).map((c, i, arr) => (
                <li key={c.id} className={`py-2.5 ${i < arr.length - 1 ? "border-b border-line" : ""}`}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-ink-3">{c.date}</span>
                    <Badge tone={c.severity === "high" ? "worsened" : c.severity === "medium" ? "info" : "ghost"} size="sm">{c.severity}</Badge>
                  </div>
                  <div className="text-[12px] text-ink">{c.kind.replace(/_/g, " ")}{c.notes ? ` — ${c.notes}` : ""}</div>
                </li>
              ))}
              {(confounders ?? []).length === 0 && <li className="py-2 text-[12px] text-ink-3">None logged.</li>}
            </ul>

            <hr className="nl-rule my-3.5" />
            <div className="grid items-end gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 32px" }}>
              <Field label="Date"><Input type="date" value={cfDate} onChange={(e) => setCfDate(e.target.value)} /></Field>
              <Field label="Kind">
                <Select value={cfKind} onChange={(e) => setCfKind(e.target.value)}>
                  {CONFOUNDER_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
                </Select>
              </Field>
              <Field label="Severity">
                <Select value={cfSeverity} onChange={(e) => setCfSeverity(e.target.value as Severity)}>
                  <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
                </Select>
              </Field>
              <Button variant="secondary" size="sm" icon={Plus} aria-label="Add confounder" onClick={() => addConfounder.mutate()} disabled={!cfDate || addConfounder.isPending} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Analysis({
  analysis,
  primary,
  recommendation,
}: {
  analysis: AnalysisResult;
  primary: OutcomeComparison | undefined;
  recommendation: string;
}) {
  const level = analysis.confidence === "medium" ? "med" : analysis.confidence;
  return (
    <>
      <div className="relative overflow-hidden rounded-sm border border-line bg-surface p-8">
        <span aria-hidden className="nl-corner nl-corner-tl" />
        <span aria-hidden className="nl-corner nl-corner-tr" />
        <span aria-hidden className="nl-corner nl-corner-bl" />
        <span aria-hidden className="nl-corner nl-corner-br" />

        <div className="mb-5 flex flex-col items-start justify-between gap-8 lg:flex-row">
          <div className="flex-1">
            <span className="label mb-2 block">Finding</span>
            <h2 className="m-0 mb-3 max-w-[540px] font-display text-[30px] font-normal leading-[1.18] tracking-(--tracking-tight) text-ink">
              {findingHeadline(primary)}
            </h2>
            <p className="m-0 max-w-[540px] font-display text-[15px] italic leading-[1.5] text-ink-2">
              {analysis.caveats[0] ?? "This is a single-person observation, not a controlled trial."}
            </p>
          </div>
          <div className="flex items-start gap-6">
            <ConfidenceMeter level={level as "low" | "med" | "high"} width={120} />
            <AdherenceMeter pct={Math.round(analysis.adherence.adherence_rate * 100)} />
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-sm border border-signal-line bg-signal-soft px-4 py-3.5">
          <Leaf className="mt-0.5 size-4 shrink-0 text-signal" />
          <div>
            <div className="mb-1 text-[13px] font-medium text-signal-ink">Recommendation</div>
            <p className="m-0 text-[13px] leading-[1.55] text-ink">{recommendation}</p>
          </div>
        </div>
      </div>

      <Card title="Outcomes" eyebrow="Baseline vs intervention">
        <div className="flex flex-col gap-[22px]">
          {analysis.comparisons.map((c, i) => {
            const numeric = c.kind === "numeric";
            const vals = [c.baseline_mean ?? 0, c.intervention_mean ?? 0];
            const scaleMin = numeric ? Math.floor(Math.min(...vals) - 1) : 1;
            const scaleMax = numeric ? Math.ceil(Math.max(...vals) + 1) : 5;
            return (
              <div key={c.outcome_id}>
                {i > 0 && <hr className="nl-rule mb-[22px]" />}
                {c.baseline_mean == null || c.intervention_mean == null ? (
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-[18px] tracking-tight text-ink">{c.name}</span>
                    <Badge tone="neutral" size="sm">inconclusive · not enough data</Badge>
                  </div>
                ) : (
                  <ComparisonBar
                    metric={c.name}
                    direction={dir(c.direction)}
                    scaleMin={scaleMin}
                    scaleMax={scaleMax}
                    unit={numeric ? "kg" : undefined}
                    baseline={{ mean: c.baseline_mean, ci: 0, n: c.baseline_n }}
                    intervention={{ mean: c.intervention_mean, ci: 0, n: c.intervention_n }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {analysis.confounder_flags.length > 0 && (
          <>
            <hr className="nl-rule my-4" />
            <div className="flex flex-col gap-2">
              {analysis.confounder_flags.map((f) => (
                <div key={f.code} className="flex items-start gap-2 text-[12px]">
                  <Badge tone={f.severity === "high" ? "worsened" : "info"} size="sm">flag</Badge>
                  <span className="text-ink-2">{f.message}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
