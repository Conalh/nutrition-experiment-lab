"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Severity } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  Field,
  confidenceTone,
  inputClass,
} from "@/components/ui";
import { ErrorState, Loading } from "@/components/states";
import { OutcomeChart } from "@/components/outcome-chart";
import { ConfounderList } from "@/components/confounder-list";

const CONFOUNDER_KINDS = [
  "illness",
  "travel",
  "poor_sleep",
  "alcohol",
  "unusual_training",
  "high_stress",
  "missed_log",
  "other",
];

export default function ExperimentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    mutationFn: () =>
      api.addConfounder(id, {
        date: cfDate,
        kind: cfKind,
        severity: cfSeverity,
        notes: cfNotes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["confounders", id] });
      setCfDate("");
      setCfNotes("");
    },
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return <ErrorState message="Could not load experiment." />;

  const { experiment: exp, interventions, outcomes } = data;

  return (
    <div>
      <Link href="/" className="text-[13px] text-muted">
        ← Dashboard
      </Link>
      <div className="my-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">{exp.title}</h1>
          <p className="mt-1 text-muted">{exp.question}</p>
        </div>
        <Badge tone="accent">{exp.status}</Badge>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {exp.status === "draft" && (
          <Button onClick={() => lifecycle.mutate("start")}>Start</Button>
        )}
        {exp.status === "active" && (
          <>
            <Button variant="ghost" onClick={() => lifecycle.mutate("pause")}>
              Pause
            </Button>
            <Button onClick={() => lifecycle.mutate("complete")}>Complete</Button>
          </>
        )}
        {exp.status === "paused" && (
          <Button onClick={() => lifecycle.mutate("resume")}>Resume</Button>
        )}
        {["completed", "active", "paused"].includes(exp.status) && (
          <Link href={`/reports/${id}`}>
            <Button variant="ghost">View report</Button>
          </Link>
        )}
      </div>
      {lifecycle.error && (
        <div className="mb-4">
          <ErrorState
            message={
              lifecycle.error instanceof Error
                ? lifecycle.error.message
                : "Error"
            }
          />
        </div>
      )}

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Protocol</h3>
        {exp.hypothesis && (
          <p className="text-sm">
            <span className="text-muted">Hypothesis: </span>
            {exp.hypothesis}
          </p>
        )}
        <div className="mb-2.5 text-[13px] text-muted">
          Baseline {exp.baseline_start} → {exp.baseline_end}
          {exp.washout_start && ` · Washout ${exp.washout_start} → ${exp.washout_end}`}
          {" · "}Intervention {exp.intervention_start} → {exp.intervention_end}
        </div>
        {interventions.map((iv) => (
          <div key={iv.id} className="mb-2">
            <strong>{iv.name}</strong> <Badge tone="neutral">{iv.category}</Badge>
            <div className="text-sm text-muted">{iv.rule_text}</div>
          </div>
        ))}
        <div className="mt-2 text-[13px]">
          <span className="text-muted">Outcomes: </span>
          {outcomes.map((o) => (
            <span key={o.id} className="mr-2.5">
              {o.name}
              {o.is_primary && <span className="text-accent"> (primary)</span>}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 font-semibold">Analysis</h3>
          <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? "Analyzing…" : "Run analysis"}
          </Button>
        </div>

        {!analysis && (
          <p className="text-sm text-muted">
            No analysis yet. Run it once you have logged some days.
          </p>
        )}

        {analysis && (
          <>
            <div className="mb-3.5 flex gap-2.5">
              <Badge tone={confidenceTone(analysis.confidence)}>
                {analysis.confidence} confidence
              </Badge>
              <Badge tone={confidenceTone(analysis.adherence.trust)}>
                adherence {Math.round(analysis.adherence.adherence_rate * 100)}%
              </Badge>
              <Badge tone="neutral">
                {Math.round(analysis.adherence.coverage * 100)}% days logged
              </Badge>
            </div>

            {analysis.comparisons.map((c) => (
              <OutcomeChart key={c.outcome_id} c={c} />
            ))}

            {analysis.confounder_flags.length > 0 && (
              <div className="mt-2.5">
                {analysis.confounder_flags.map((f) => (
                  <div key={f.code} className="mb-1.5 flex gap-2">
                    <Badge tone={f.severity === "high" ? "bad" : "warn"}>
                      flag
                    </Badge>
                    <span className="text-[13px]">{f.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3.5 rounded-lg bg-surface p-3 text-sm">
              <strong>Recommendation:</strong> {analysis.recommendation}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h3 className="mt-0 font-semibold">Confounders</h3>
        <ConfounderList items={confounders ?? []} />
        <div className="mt-3.5 grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-end gap-2">
          <Field label="Date">
            <input type="date" className={inputClass} value={cfDate} onChange={(e) => setCfDate(e.target.value)} />
          </Field>
          <Field label="Kind">
            <select className={inputClass} value={cfKind} onChange={(e) => setCfKind(e.target.value)}>
              {CONFOUNDER_KINDS.map((k) => (
                <option key={k} value={k}>{k.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select className={inputClass} value={cfSeverity} onChange={(e) => setCfSeverity(e.target.value as Severity)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Field>
          <Field label="Notes">
            <input className={inputClass} value={cfNotes} onChange={(e) => setCfNotes(e.target.value)} />
          </Field>
          <Button onClick={() => addConfounder.mutate()} disabled={!cfDate || addConfounder.isPending}>
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
