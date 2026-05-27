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
import { Badge, Button, Card, Field, inputStyle } from "@/components/ui";
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
        intervention_start: intvStart || null,
        intervention_end: intvEnd || null,
      });
      if (intvName.trim() && intvRule.trim()) {
        await api.addIntervention(exp.id, {
          name: intvName,
          rule_text: intvRule,
        });
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
      if (startNow) {
        await api.lifecycle(exp.id, "start");
      }
      router.push(`/experiments/${exp.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Design an experiment
      </h1>
      <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
        Ask one clear question and change one thing.
      </p>

      <SafetyNotice />

      <Card style={{ marginBottom: 16 }}>
        <Field label="Title">
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Higher-protein breakfast vs afternoon hunger"
          />
        </Field>
        <Field label="Question">
          <input
            style={inputStyle}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Does a higher-protein breakfast reduce my afternoon hunger?"
          />
        </Field>
        <Field label="Hypothesis (optional)">
          <textarea
            style={{ ...inputStyle, minHeight: 60 }}
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
          />
        </Field>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Windows</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Baseline start">
            <input type="date" style={inputStyle} value={baselineStart} onChange={(e) => setBaselineStart(e.target.value)} />
          </Field>
          <Field label="Baseline end">
            <input type="date" style={inputStyle} value={baselineEnd} onChange={(e) => setBaselineEnd(e.target.value)} />
          </Field>
          <Field label="Intervention start">
            <input type="date" style={inputStyle} value={intvStart} onChange={(e) => setIntvStart(e.target.value)} />
          </Field>
          <Field label="Intervention end" hint={intvDays ? `${intvDays} days` : undefined}>
            <input type="date" style={inputStyle} value={intvEnd} onChange={(e) => setIntvEnd(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Intervention</h3>
        <Field label="Name">
          <input style={inputStyle} value={intvName} onChange={(e) => setIntvName(e.target.value)} placeholder="40g protein breakfast" />
        </Field>
        <Field label="Rule" hint="What exactly will you change? Keep it to one variable.">
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={intvRule} onChange={(e) => setIntvRule(e.target.value)} placeholder="Eat at least 40g of protein within an hour of waking." />
        </Field>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Outcomes</h3>
          <Button variant="ghost" onClick={addOutcome}>+ Add</Button>
        </div>
        {outcomes.map((o, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr auto auto",
              gap: 8,
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <input style={inputStyle} value={o.name} placeholder="Outcome name" onChange={(e) => updateOutcome(i, { name: e.target.value })} />
            <select style={inputStyle} value={o.metric} onChange={(e) => updateOutcome(i, { metric: e.target.value as Metric })}>
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select style={inputStyle} value={o.direction} onChange={(e) => updateOutcome(i, { direction: e.target.value as OutcomeDirection })}>
              <option value="higher_better">Higher better</option>
              <option value="lower_better">Lower better</option>
              <option value="target_range">Target range</option>
            </select>
            <label style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", gap: 4, alignItems: "center" }}>
              <input type="radio" name="primary" checked={o.is_primary} onChange={() => setPrimary(i)} />
              primary
            </label>
            {outcomes.length > 1 && (
              <button onClick={() => removeOutcome(i)} style={{ background: "none", border: "none", color: "var(--bad)", cursor: "pointer" }}>×</button>
            )}
          </div>
        ))}
      </Card>

      {warnings && warnings.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: "var(--warn)" }}>
          <h3 style={{ marginTop: 0, color: "var(--warn)" }}>Heads up</h3>
          {warnings.map((w: SafetyWarning) => (
            <div key={w.code} style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "start" }}>
              <Badge tone={w.severity === "high" ? "bad" : "warn"}>{w.severity}</Badge>
              <span style={{ fontSize: 14 }}>{w.message}</span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
            These are advisory — you can still proceed.
          </p>
        </Card>
      )}

      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
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
