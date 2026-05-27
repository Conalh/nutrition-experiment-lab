"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  type Metric,
  type OutcomeDirection,
  type SafetyWarning,
} from "@/lib/api";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui";
import { ErrorState } from "@/components/states";
import { SafetyNotice } from "@/components/safety-notice";

const METRICS: { value: Metric; label: string; numeric?: boolean }[] = [
  { value: "hunger", label: "Hunger" },
  { value: "energy", label: "Energy" },
  { value: "digestion", label: "Digestion" },
  { value: "sleep_quality", label: "Sleep quality" },
  { value: "training_performance", label: "Training performance" },
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

export default function NewExperiment() {
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
  const primaryKind = useMemo(() => {
    const p = outcomes.find((o) => o.is_primary);
    return p && METRICS.find((m) => m.value === p.metric)?.numeric
      ? "numeric"
      : "rating";
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
          kind: METRICS.find((m) => m.value === o.metric)?.numeric
            ? "numeric"
            : "rating",
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
    <div>
      <h1 className="text-2xl font-bold">Design an experiment</h1>
      <p className="mt-0 text-muted">Ask one clear question and change one thing.</p>

      <SafetyNotice />

      <Card className="mb-4">
        <Field label="Title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Higher-protein breakfast vs afternoon hunger"
          />
        </Field>
        <Field label="Question">
          <input
            className={inputClass}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Does a higher-protein breakfast reduce my afternoon hunger?"
          />
        </Field>
        <Field label="Hypothesis (optional)">
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
          />
        </Field>
      </Card>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Windows</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Baseline start">
            <input type="date" className={inputClass} value={baselineStart} onChange={(e) => setBaselineStart(e.target.value)} />
          </Field>
          <Field label="Baseline end">
            <input type="date" className={inputClass} value={baselineEnd} onChange={(e) => setBaselineEnd(e.target.value)} />
          </Field>
          <Field label="Intervention start">
            <input type="date" className={inputClass} value={intvStart} onChange={(e) => setIntvStart(e.target.value)} />
          </Field>
          <Field label="Intervention end" hint={intvDays ? `${intvDays} days` : undefined}>
            <input type="date" className={inputClass} value={intvEnd} onChange={(e) => setIntvEnd(e.target.value)} />
          </Field>
        </div>

        <label className="mt-1 flex items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={useWashout}
            onChange={(e) => setUseWashout(e.target.checked)}
          />
          Add a washout period between baseline and intervention
        </label>
        {useWashout && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Washout start">
              <input type="date" className={inputClass} value={washoutStart} onChange={(e) => setWashoutStart(e.target.value)} />
            </Field>
            <Field label="Washout end">
              <input type="date" className={inputClass} value={washoutEnd} onChange={(e) => setWashoutEnd(e.target.value)} />
            </Field>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Intervention</h3>
        <Field label="Name">
          <input className={inputClass} value={intvName} onChange={(e) => setIntvName(e.target.value)} placeholder="40g protein breakfast" />
        </Field>
        <Field label="Rule" hint="What exactly will you change? Keep it to one variable.">
          <textarea className={`${inputClass} min-h-[60px]`} value={intvRule} onChange={(e) => setIntvRule(e.target.value)} placeholder="Eat at least 40g of protein within an hour of waking." />
        </Field>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="m-0 font-semibold">Outcomes</h3>
          <Button variant="ghost" onClick={addOutcome}>+ Add</Button>
        </div>
        {outcomes.map((o, i) => (
          <div
            key={i}
            className="mt-3 grid grid-cols-[1.4fr_1fr_1fr_auto_auto] items-center gap-2"
          >
            <input className={inputClass} value={o.name} placeholder="Outcome name" onChange={(e) => updateOutcome(i, { name: e.target.value })} />
            <select className={inputClass} value={o.metric} onChange={(e) => updateOutcome(i, { metric: e.target.value as Metric })}>
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select className={inputClass} value={o.direction} onChange={(e) => updateOutcome(i, { direction: e.target.value as OutcomeDirection })}>
              <option value="higher_better">Higher better</option>
              <option value="lower_better">Lower better</option>
              <option value="target_range">Target range</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="radio" name="primary" checked={o.is_primary} onChange={() => setPrimary(i)} />
              primary
            </label>
            {outcomes.length > 1 && (
              <button onClick={() => removeOutcome(i)} className="cursor-pointer border-none bg-transparent text-bad">×</button>
            )}
          </div>
        ))}
      </Card>

      {warnings && warnings.length > 0 && (
        <Card tone="warn" className="mb-4">
          <h3 className="mt-0 font-semibold text-warn">Heads up</h3>
          {warnings.map((w: SafetyWarning) => (
            <div key={w.code} className="mb-2 flex items-start gap-2">
              <Badge tone={w.severity === "high" ? "bad" : "warn"}>{w.severity}</Badge>
              <span className="text-sm">{w.message}</span>
            </div>
          ))}
          <p className="m-0 text-xs text-muted">
            These are advisory — you can still proceed.
          </p>
        </Card>
      )}

      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="flex gap-2.5">
        <Button onClick={() => submit(true)} disabled={submitting}>
          {submitting ? "Saving…" : "Create & start"}
        </Button>
        <Button variant="ghost" onClick={() => submit(false)} disabled={submitting}>
          Save as draft
        </Button>
      </div>
    </div>
  );
}
