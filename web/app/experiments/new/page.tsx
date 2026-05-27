"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Info, Plus, ArrowRight, Trash2 } from "lucide-react";
import {
  api,
  type Metric,
  type OutcomeDirection,
  type SafetyWarning,
} from "@/lib/api";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KV } from "@/components/ui/kv";

const METRICS: { value: Metric; label: string; numeric?: boolean }[] = [
  { value: "hunger", label: "Hunger" },
  { value: "energy", label: "Energy" },
  { value: "digestion", label: "Digestion" },
  { value: "sleep_quality", label: "Sleep quality" },
  { value: "training_performance", label: "Training" },
  { value: "body_weight", label: "Body weight", numeric: true },
];

interface OutcomeDraft {
  name: string;
  metric: Metric;
  direction: OutcomeDirection;
  is_primary: boolean;
}

function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.round(d) + 1 : null;
}

export default function BuilderPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [baselineStart, setBaselineStart] = useState("");
  const [baselineEnd, setBaselineEnd] = useState("");
  const [intvStart, setIntvStart] = useState("");
  const [intvEnd, setIntvEnd] = useState("");
  const [useWashout, setUseWashout] = useState(false);
  const [washoutStart, setWashoutStart] = useState("");
  const [washoutEnd, setWashoutEnd] = useState("");
  const [intvName, setIntvName] = useState("");
  const [intvRule, setIntvRule] = useState("");
  const [outcomes, setOutcomes] = useState<OutcomeDraft[]>([
    { name: "Afternoon hunger", metric: "hunger", direction: "lower_better", is_primary: true },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intvDays = daysBetween(intvStart, intvEnd);
  const baselineDays = daysBetween(baselineStart, baselineEnd);
  const primaryKind = useMemo(() => {
    const p = outcomes.find((o) => o.is_primary);
    return p && METRICS.find((m) => m.value === p.metric)?.numeric ? "numeric" : "rating";
  }, [outcomes]);

  const { data: warnings } = useQuery({
    queryKey: ["safety", question, hypothesis, intvRule, intvDays, primaryKind],
    queryFn: () =>
      api.checkSafety({
        question,
        hypothesis,
        intervention_rule: intvRule,
        intervention_window_days: intvDays,
        primary_outcome_kind: primaryKind,
      }),
    enabled: intvRule.length > 3 || question.length > 5,
  });

  function setPrimary(idx: number) {
    setOutcomes((os) => os.map((o, i) => ({ ...o, is_primary: i === idx })));
  }
  function updateOutcome(idx: number, patch: Partial<OutcomeDraft>) {
    setOutcomes((os) => os.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }
  function addOutcome() {
    setOutcomes((os) => [
      ...os,
      { name: "", metric: "energy", direction: "higher_better", is_primary: false },
    ]);
  }
  function removeOutcome(idx: number) {
    setOutcomes((os) => os.filter((_, i) => i !== idx));
  }

  async function submit(startNow: boolean) {
    setError(null);
    if (!title.trim() || !question.trim()) {
      setError("Title and question are required.");
      return;
    }
    if (!outcomes.some((o) => o.is_primary && o.name.trim())) {
      setError("Mark one named outcome as primary.");
      return;
    }
    setSubmitting(true);
    try {
      const exp = await api.createExperiment({
        title,
        question,
        hypothesis: hypothesis || null,
        baseline_start: baselineStart || null,
        baseline_end: baselineEnd || null,
        washout_start: useWashout ? washoutStart || null : null,
        washout_end: useWashout ? washoutEnd || null : null,
        intervention_start: intvStart || null,
        intervention_end: intvEnd || null,
      });
      if (intvName.trim() && intvRule.trim()) {
        await api.addIntervention(exp.id, { name: intvName, rule_text: intvRule });
      }
      for (const o of outcomes.filter((o) => o.name.trim())) {
        await api.addOutcome(exp.id, {
          name: o.name,
          metric: o.metric,
          direction: o.direction,
          kind: METRICS.find((m) => m.value === o.metric)?.numeric ? "numeric" : "rating",
          is_primary: o.is_primary,
        });
      }
      if (startNow) await api.lifecycle(exp.id, "start");
      router.push(`/experiments/${exp.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <TopBar
        breadcrumb={["Lab", "New experiment"]}
        title={title.trim() || "New experiment"}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => submit(false)} disabled={submitting}>
              Save draft
            </Button>
            <Button variant="primary" size="sm" iconRight={ArrowRight} onClick={() => submit(true)} disabled={submitting}>
              {submitting ? "Saving…" : "Start logging"}
            </Button>
          </>
        }
      />

      <div
        className="grid flex-1 items-start gap-6 overflow-y-auto px-8 py-6 max-lg:grid-cols-1"
        style={{ gridTemplateColumns: "1fr 360px" }}
      >
        {/* LEFT — protocol form */}
        <div className="flex flex-col gap-4">
          <Card eyebrow="01 · The question" title="What are you trying to learn?" actions={<span className="label">Be specific. Single variable.</span>}>
            <div className="flex flex-col gap-4">
              <Field label="Title" required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Higher-protein breakfast vs afternoon hunger" />
              </Field>
              <Field label="Question" required hint="one sentence">
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Does a higher-protein breakfast reduce my afternoon hunger?" />
              </Field>
              <Field label="Hypothesis" hint="predicted direction">
                <Textarea rows={2} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="More protein at breakfast lowers my 2–5pm hunger." />
              </Field>
            </div>
          </Card>

          <Card eyebrow="02 · Schedule" title="Baseline → intervention">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Baseline start"><Input type="date" value={baselineStart} onChange={(e) => setBaselineStart(e.target.value)} /></Field>
                <Field label="Baseline end" hint={baselineDays ? `${baselineDays}d` : undefined}><Input type="date" value={baselineEnd} onChange={(e) => setBaselineEnd(e.target.value)} /></Field>
                <Field label="Intervention start"><Input type="date" value={intvStart} onChange={(e) => setIntvStart(e.target.value)} /></Field>
                <Field label="Intervention end" hint={intvDays ? `${intvDays}d` : undefined}><Input type="date" value={intvEnd} onChange={(e) => setIntvEnd(e.target.value)} /></Field>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-ink-3">
                <input type="checkbox" checked={useWashout} onChange={(e) => setUseWashout(e.target.checked)} />
                Add a washout period between baseline and intervention
              </label>
              {useWashout && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Washout start"><Input type="date" value={washoutStart} onChange={(e) => setWashoutStart(e.target.value)} /></Field>
                  <Field label="Washout end"><Input type="date" value={washoutEnd} onChange={(e) => setWashoutEnd(e.target.value)} /></Field>
                </div>
              )}
              <Field label="Intervention" hint="name">
                <Input value={intvName} onChange={(e) => setIntvName(e.target.value)} placeholder="40g protein breakfast" />
              </Field>
              <Field label="Intervention rule" hint="what you change, exactly">
                <Textarea rows={2} value={intvRule} onChange={(e) => setIntvRule(e.target.value)} placeholder="Eat at least 40g of protein within an hour of waking." />
              </Field>
            </div>
          </Card>

          <Card eyebrow="03 · Outcomes" title="What are you measuring?" actions={<Button variant="ghost" size="sm" icon={Plus} onClick={addOutcome}>Add outcome</Button>}>
            <div className="flex flex-col gap-2">
              {outcomes.map((o, i) => (
                <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 80px 32px" }}>
                  <Input value={o.name} placeholder="Outcome name" onChange={(e) => updateOutcome(i, { name: e.target.value })} />
                  <Select value={o.metric} onChange={(e) => updateOutcome(i, { metric: e.target.value as Metric })}>
                    {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                  <Select value={o.direction} onChange={(e) => updateOutcome(i, { direction: e.target.value as OutcomeDirection })}>
                    <option value="higher_better">↑ higher</option>
                    <option value="lower_better">↓ lower</option>
                    <option value="target_range">◇ target</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setPrimary(i)}
                    className="flex h-9 items-center justify-center rounded-sm border border-line text-[11px]"
                    aria-pressed={o.is_primary}
                  >
                    {o.is_primary ? <Badge tone="signal" size="sm">Primary</Badge> : <span className="text-ink-4">set</span>}
                  </button>
                  {outcomes.length > 1 ? (
                    <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove outcome" onClick={() => removeOutcome(i)} />
                  ) : <span />}
                </div>
              ))}
            </div>
          </Card>

          {error && <p className="m-0 text-[13px] text-worsened">{error}</p>}
        </div>

        {/* RIGHT — advisory + summary */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0">
          <SafetyAdvisory warnings={warnings ?? []} />
          <Card eyebrow="Summary" title="At a glance">
            <KV
              rows={[
                ["Baseline", baselineDays ? `${baselineDays} days` : "—", { mono: true }],
                ["Intervention", intvDays ? `${intvDays} days` : "—", { mono: true }],
                ["Outcomes", String(outcomes.filter((o) => o.name.trim()).length), { mono: true }],
                ["Time per log", "< 1 min"],
                ["Min. for analysis", "≥ 3 days / window", { mono: true }],
              ]}
            />
          </Card>
        </aside>
      </div>
    </>
  );
}

function SafetyAdvisory({ warnings }: { warnings: SafetyWarning[] }) {
  const clean = warnings.length === 0;
  return (
    <Card
      eyebrow="Advisory"
      title="Safety checks"
      actions={<span className="text-[11px] text-ink-4">{clean ? "all clear" : `${warnings.length} flag${warnings.length === 1 ? "" : "s"}`}</span>}
    >
      <ul className="m-0 flex flex-col gap-0 p-0">
        {clean ? (
          <li className="flex items-start gap-3 py-2.5">
            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-improved-line bg-improved-soft text-improved" aria-hidden>
              <Check className="size-2.5" />
            </span>
            <div className="flex-1 text-[12px] text-ink-2">
              Nothing flagged. Keep it to one clear change and a window long enough to trust.
            </div>
          </li>
        ) : (
          warnings.map((w, i) => (
            <li key={w.code} className={`flex items-start gap-3 py-2.5 ${i < warnings.length - 1 ? "border-b border-line" : ""}`}>
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border ${
                  w.severity === "high"
                    ? "border-worsened-line bg-worsened-soft text-worsened"
                    : "border-info-line bg-info-soft text-info"
                }`}
                aria-hidden
              >
                <Info className="size-2.5" />
              </span>
              <div className="flex-1">
                <div className="text-[12px] font-medium text-ink capitalize">{w.code.replace(/_/g, " ")}</div>
                <div className="mt-0.5 text-[11px] leading-[1.5] text-ink-3">{w.message}</div>
              </div>
            </li>
          ))
        )}
      </ul>
      <p className="mt-3 rounded-sm border border-line bg-surface-3 px-3 py-2.5 text-[11px] leading-[1.5] text-ink-3">
        Advisories are heuristics, not medical advice. Consult a clinician for anything related to a diagnosed condition.
      </p>
    </Card>
  );
}
