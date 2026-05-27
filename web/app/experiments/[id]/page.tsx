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
  inputStyle,
} from "@/components/ui";
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

  if (isLoading) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
  if (error || !data)
    return <p style={{ color: "var(--bad)" }}>Could not load experiment.</p>;

  const { experiment: exp, interventions, outcomes } = data;

  return (
    <div>
      <Link href="/" style={{ color: "var(--text-dim)", fontSize: 13 }}>
        ← Dashboard
      </Link>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          margin: "8px 0 20px",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {exp.title}
          </h1>
          <p style={{ color: "var(--text-dim)", margin: "4px 0 0" }}>
            {exp.question}
          </p>
        </div>
        <Badge tone="accent">{exp.status}</Badge>
      </div>

      {/* Lifecycle actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {exp.status === "draft" && (
          <Button onClick={() => lifecycle.mutate("start")}>Start</Button>
        )}
        {exp.status === "active" && (
          <>
            <Button variant="ghost" onClick={() => lifecycle.mutate("pause")}>
              Pause
            </Button>
            <Button onClick={() => lifecycle.mutate("complete")}>
              Complete
            </Button>
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
        <p style={{ color: "var(--bad)" }}>
          {lifecycle.error instanceof Error ? lifecycle.error.message : "Error"}
        </p>
      )}

      {/* Protocol */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Protocol</h3>
        {exp.hypothesis && (
          <p style={{ fontSize: 14 }}>
            <span style={{ color: "var(--text-dim)" }}>Hypothesis: </span>
            {exp.hypothesis}
          </p>
        )}
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 10 }}>
          Baseline {exp.baseline_start} → {exp.baseline_end} · Intervention{" "}
          {exp.intervention_start} → {exp.intervention_end}
        </div>
        {interventions.map((iv) => (
          <div key={iv.id} style={{ marginBottom: 8 }}>
            <strong>{iv.name}</strong>{" "}
            <Badge tone="neutral">{iv.category}</Badge>
            <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
              {iv.rule_text}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <span style={{ color: "var(--text-dim)" }}>Outcomes: </span>
          {outcomes.map((o) => (
            <span key={o.id} style={{ marginRight: 10 }}>
              {o.name}
              {o.is_primary && (
                <span style={{ color: "var(--accent)" }}> (primary)</span>
              )}
            </span>
          ))}
        </div>
      </Card>

      {/* Analysis */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Analysis</h3>
          <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? "Analyzing…" : "Run analysis"}
          </Button>
        </div>

        {!analysis && (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            No analysis yet. Run it once you have logged some days.
          </p>
        )}

        {analysis && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
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
              <div style={{ marginTop: 10 }}>
                {analysis.confounder_flags.map((f) => (
                  <div
                    key={f.code}
                    style={{ display: "flex", gap: 8, marginBottom: 6 }}
                  >
                    <Badge tone={f.severity === "high" ? "bad" : "warn"}>
                      flag
                    </Badge>
                    <span style={{ fontSize: 13 }}>{f.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: "var(--surface-2)",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <strong>Recommendation:</strong> {analysis.recommendation}
            </div>
          </>
        )}
      </Card>

      {/* Confounders */}
      <Card>
        <h3 style={{ marginTop: 0 }}>Confounders</h3>
        <ConfounderList items={confounders ?? []} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 2fr auto",
            gap: 8,
            alignItems: "end",
            marginTop: 14,
          }}
        >
          <Field label="Date">
            <input type="date" style={inputStyle} value={cfDate} onChange={(e) => setCfDate(e.target.value)} />
          </Field>
          <Field label="Kind">
            <select style={inputStyle} value={cfKind} onChange={(e) => setCfKind(e.target.value)}>
              {CONFOUNDER_KINDS.map((k) => (
                <option key={k} value={k}>{k.replace("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select style={inputStyle} value={cfSeverity} onChange={(e) => setCfSeverity(e.target.value as Severity)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Field>
          <Field label="Notes">
            <input style={inputStyle} value={cfNotes} onChange={(e) => setCfNotes(e.target.value)} />
          </Field>
          <Button onClick={() => addConfounder.mutate()} disabled={!cfDate || addConfounder.isPending}>
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
