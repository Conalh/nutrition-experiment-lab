"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge, Button, Card, confidenceTone } from "@/components/ui";
import { OutcomeChart } from "@/components/outcome-chart";
import { ConfounderList } from "@/components/confounder-list";
import { SafetyNotice } from "@/components/safety-notice";

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => api.getReport(id),
  });

  if (isLoading) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
  if (error || !report)
    return <p style={{ color: "var(--bad)" }}>Could not load report.</p>;

  const comparisons = [
    ...(report.primary_outcome ? [report.primary_outcome] : []),
    ...report.secondary_outcomes,
  ];

  return (
    <div>
      <Link
        href={`/experiments/${id}`}
        style={{ color: "var(--text-dim)", fontSize: 13 }}
      >
        ← Experiment
      </Link>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: 12,
          margin: "8px 0 20px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {report.title}
          </h1>
          <p style={{ color: "var(--text-dim)", margin: "4px 0 0" }}>
            {report.question}
          </p>
        </div>
        <a href={api.reportPdfUrl(id)} target="_blank" rel="noreferrer">
          <Button variant="ghost">Download PDF</Button>
        </a>
      </div>

      <SafetyNotice compact />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Badge tone={confidenceTone(report.confidence)}>
            {report.confidence} confidence
          </Badge>
          <Badge tone={confidenceTone(report.adherence.trust)}>
            {Math.round(report.adherence.adherence_rate * 100)}% adherence
          </Badge>
          <Badge tone="neutral">
            {Math.round(report.adherence.coverage * 100)}% of days logged
          </Badge>
        </div>
        {report.hypothesis && (
          <p style={{ fontSize: 14 }}>
            <span style={{ color: "var(--text-dim)" }}>Hypothesis: </span>
            {report.hypothesis}
          </p>
        )}
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Baseline {report.baseline_start} → {report.baseline_end} ·
          Intervention {report.intervention_start} → {report.intervention_end}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Outcomes</h3>
        {comparisons.map((c) => (
          <OutcomeChart key={c.outcome_id} c={c} />
        ))}
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Card>
          <h3 style={{ marginTop: 0 }}>What changed</h3>
          {report.what_changed.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Nothing notable.</p>
          ) : (
            <ul style={{ paddingLeft: 18, fontSize: 14 }}>
              {report.what_changed.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 style={{ marginTop: 0 }}>What did not change</h3>
          {report.what_did_not_change.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>—</p>
          ) : (
            <ul style={{ paddingLeft: 18, fontSize: 14 }}>
              {report.what_did_not_change.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Confounders</h3>
        <ConfounderList items={report.confounders} />
      </Card>

      {report.meal_examples.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Meal examples</h3>
          {report.meal_examples.map((m, i) => (
            <div key={i} style={{ fontSize: 14, marginBottom: 6 }}>
              <Badge tone="neutral">{m.phase}</Badge>{" "}
              <span>{m.description}</span>
            </div>
          ))}
        </Card>
      )}

      <Card
        style={{ marginBottom: 16, background: "var(--accent-dim)", borderColor: "var(--accent)" }}
      >
        <h3 style={{ marginTop: 0 }}>Recommendation</h3>
        <p style={{ fontSize: 15, margin: 0 }}>{report.recommendation}</p>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 0 }}>
          Decision: {report.decision}
        </p>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)" }}>
          CAVEATS
        </h3>
        <ul style={{ paddingLeft: 18, fontSize: 13, color: "var(--text-dim)" }}>
          {report.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
