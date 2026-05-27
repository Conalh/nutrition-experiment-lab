"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, Leaf, Pencil, Play, Plus, Square, Pause, Trash2, X,
} from "lucide-react";
import {
  api,
  type AnalysisResult,
  type ExperimentDetail,
  type Metric,
  type OutcomeComparison,
  type OutcomeDirection,
  type Severity,
} from "@/lib/api";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
const METRICS: { value: Metric; label: string; numeric?: boolean }[] = [
  { value: "hunger", label: "Hunger" },
  { value: "energy", label: "Energy" },
  { value: "digestion", label: "Digestion" },
  { value: "sleep_quality", label: "Sleep quality" },
  { value: "training_performance", label: "Training" },
  { value: "body_weight", label: "Body weight", numeric: true },
];
const EDITABLE = ["draft", "active", "paused"];

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
    return (<>{p.name} {verb} by <em className="not-italic text-improved">{delta}{unit}</em> during the intervention window — a meaningful change.</>);
  }
  if (p.result === "worsened") {
    return (<>{p.name} moved <em className="not-italic text-worsened">the wrong way</em> during the intervention window.</>);
  }
  if (p.result === "unchanged") return <>{p.name} didn&apos;t move much between the two windows.</>;
  return <>Not enough clean data to call {p.name} yet.</>;
}

export default function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const refreshExp = () => qc.invalidateQueries({ queryKey: ["experiment", id] });

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
    mutationFn: (args: { action: string; body?: Record<string, unknown> }) =>
      api.lifecycle(id, args.action, args.body),
    onSuccess: () => {
      refreshExp();
      qc.invalidateQueries({ queryKey: ["experiments"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteExperiment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["experiments"] });
      router.push("/");
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

  const [abandoning, setAbandoning] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return (<><TopBar title="Experiment" /><Loading /></>);
  if (error || !data) return (<><TopBar title="Experiment" /><div className="p-10"><ErrorState message="Could not load experiment." /></div></>);

  const { experiment: exp, interventions, outcomes } = data;
  const primary = analysis?.comparisons.find((c) => c.is_primary);
  const editable = EDITABLE.includes(exp.status);

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
            {exp.hypothesis && <p className="mt-2 text-[12px] leading-[1.5] text-ink-3">{exp.hypothesis}</p>}
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
              {exp.status === "draft" && <Button variant="primary" size="md" full icon={Play} onClick={() => lifecycle.mutate({ action: "start" })}>Start logging</Button>}
              {exp.status === "active" && <Button variant="secondary" size="md" full icon={Pause} onClick={() => lifecycle.mutate({ action: "pause" })}>Pause</Button>}
              {exp.status === "paused" && <Button variant="primary" size="md" full icon={Play} onClick={() => lifecycle.mutate({ action: "resume" })}>Resume</Button>}
              {["active", "paused"].includes(exp.status) && <Button variant="secondary" size="md" full icon={Square} onClick={() => lifecycle.mutate({ action: "complete" })}>Complete</Button>}
              <Button variant="secondary" size="md" full onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                {analyze.isPending ? "Analyzing…" : "Run analysis"}
              </Button>

              {editable && !abandoning && (
                <Button variant="ghost" size="md" full onClick={() => setAbandoning(true)}>Abandon</Button>
              )}
              {abandoning && (
                <div className="flex flex-col gap-2 rounded-sm border border-line p-2.5">
                  <Field label="Reason for stopping">
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="schedule changed" />
                  </Field>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={!reason.trim() || lifecycle.isPending}
                      onClick={() => lifecycle.mutate({ action: "abandon", body: { stop_reason: reason } }, { onSuccess: () => setAbandoning(false) })}>
                      Confirm
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAbandoning(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
            {lifecycle.error && <p className="mt-2 text-[12px] text-worsened">{lifecycle.error instanceof Error ? lifecycle.error.message : "Error"}</p>}

            <hr className="nl-rule my-3" />
            {!confirmDelete ? (
              <Button variant="danger" size="md" full icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete experiment</Button>
            ) : (
              <div className="flex flex-col gap-2 rounded-sm border border-worsened-line p-2.5">
                <p className="m-0 text-[12px] text-ink-2">Delete this experiment and all its data? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
                    {remove.isPending ? "Deleting…" : "Delete"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>
        </aside>

        {/* Main */}
        <div className="flex flex-col gap-4">
          {editable && (
            <ProtocolEditor id={id} detail={data} onChange={refreshExp} />
          )}

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

function ProtocolEditor({
  id, detail, onChange,
}: {
  id: string;
  detail: ExperimentDetail;
  onChange: () => void;
}) {
  const { experiment: exp, interventions, outcomes } = detail;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(exp.title);
  const [question, setQuestion] = useState(exp.question);
  const [hypothesis, setHypothesis] = useState(exp.hypothesis ?? "");
  const [ivName, setIvName] = useState("");
  const [ivRule, setIvRule] = useState("");
  const [ocName, setOcName] = useState("");
  const [ocMetric, setOcMetric] = useState<Metric>("energy");
  const [ocDir, setOcDir] = useState<OutcomeDirection>("higher_better");

  const after = { onSuccess: onChange };
  const saveProtocol = useMutation({ mutationFn: () => api.updateExperiment(id, { title, question, hypothesis: hypothesis || null }), ...after });
  const addIv = useMutation({ mutationFn: () => api.addIntervention(id, { name: ivName, rule_text: ivRule }), onSuccess: () => { onChange(); setIvName(""); setIvRule(""); } });
  const delIv = useMutation({ mutationFn: (ivId: string) => api.deleteIntervention(ivId), ...after });
  const addOc = useMutation({
    mutationFn: () => api.addOutcome(id, { name: ocName, metric: ocMetric, direction: ocDir, kind: METRICS.find((m) => m.value === ocMetric)?.numeric ? "numeric" : "rating" }),
    onSuccess: () => { onChange(); setOcName(""); },
  });
  const setPrimary = useMutation({ mutationFn: (ocId: string) => api.updateOutcome(ocId, { is_primary: true }), ...after });
  const delOc = useMutation({ mutationFn: (ocId: string) => api.deleteOutcome(ocId), ...after });

  if (!open) {
    return (
      <Card eyebrow="Protocol" title="Edit the protocol" actions={<Button variant="secondary" size="sm" icon={Pencil} onClick={() => setOpen(true)}>Edit</Button>}>
        <p className="m-0 text-[12px] text-ink-3">Refine the question, manage interventions and outcomes while the experiment is still running.</p>
      </Card>
    );
  }

  return (
    <Card eyebrow="Protocol" title="Edit the protocol" actions={<Button variant="ghost" size="sm" icon={X} aria-label="Close" onClick={() => setOpen(false)} />}>
      <div className="flex flex-col gap-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Question"><Input value={question} onChange={(e) => setQuestion(e.target.value)} /></Field>
        <Field label="Hypothesis"><Textarea rows={2} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} /></Field>
        <div>
          <Button variant="secondary" size="sm" disabled={saveProtocol.isPending} onClick={() => saveProtocol.mutate()}>
            {saveProtocol.isPending ? "Saving…" : "Save protocol"}
          </Button>
        </div>

        <hr className="nl-rule" />
        <div>
          <span className="label">Interventions</span>
          {interventions.map((iv) => (
            <div key={iv.id} className="mt-2 flex items-center justify-between gap-2 border-b border-line pb-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">{iv.name}</div>
                <div className="truncate text-[12px] text-ink-3">{iv.rule_text}</div>
              </div>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label="Delete intervention" onClick={() => delIv.mutate(iv.id)} />
            </div>
          ))}
          <div className="mt-2 grid items-end gap-2" style={{ gridTemplateColumns: "1fr 1.4fr 32px" }}>
            <Input value={ivName} onChange={(e) => setIvName(e.target.value)} placeholder="name" />
            <Input value={ivRule} onChange={(e) => setIvRule(e.target.value)} placeholder="rule" />
            <Button variant="secondary" size="sm" icon={Plus} aria-label="Add intervention" disabled={!ivName.trim() || !ivRule.trim() || addIv.isPending} onClick={() => addIv.mutate()} />
          </div>
        </div>

        <hr className="nl-rule" />
        <div>
          <span className="label">Outcomes</span>
          {outcomes.map((o) => (
            <div key={o.id} className="mt-2 flex items-center justify-between gap-2 border-b border-line pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-ink">{o.name}</span>
                <span className="font-mono text-[11px] text-ink-4">{o.metric ?? "—"}</span>
                {o.is_primary && <Badge tone="signal" size="sm">primary</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {!o.is_primary && <Button variant="ghost" size="sm" onClick={() => setPrimary.mutate(o.id)}>set primary</Button>}
                <Button variant="ghost" size="sm" icon={Trash2} aria-label="Delete outcome" onClick={() => delOc.mutate(o.id)} />
              </div>
            </div>
          ))}
          <div className="mt-2 grid items-end gap-2" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 32px" }}>
            <Input value={ocName} onChange={(e) => setOcName(e.target.value)} placeholder="outcome" />
            <Select value={ocMetric} onChange={(e) => setOcMetric(e.target.value as Metric)}>
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
            <Select value={ocDir} onChange={(e) => setOcDir(e.target.value as OutcomeDirection)}>
              <option value="higher_better">↑ higher</option>
              <option value="lower_better">↓ lower</option>
              <option value="target_range">◇ target</option>
            </Select>
            <Button variant="secondary" size="sm" icon={Plus} aria-label="Add outcome" disabled={!ocName.trim() || addOc.isPending} onClick={() => addOc.mutate()} />
          </div>
        </div>
      </div>
    </Card>
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
