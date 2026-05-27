"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge, Button, Card, confidenceTone } from "@/components/ui";
import { ErrorState, Loading } from "@/components/states";
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

  if (isLoading) return <Loading />;
  if (error || !report) return <ErrorState message="Could not load report." />;

  const comparisons = [
    ...(report.primary_outcome ? [report.primary_outcome] : []),
    ...report.secondary_outcomes,
  ];

  return (
    <div>
      <Link href={`/experiments/${id}`} className="text-[13px] text-muted">
        ← Experiment
      </Link>
      <div className="my-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">{report.title}</h1>
          <p className="mt-1 text-muted">{report.question}</p>
        </div>
        <a href={api.reportPdfUrl(id)} target="_blank" rel="noreferrer">
          <Button variant="ghost">Download PDF</Button>
        </a>
      </div>

      <SafetyNotice compact />

      <Card className="mb-4">
        <div className="mb-3 flex gap-2.5">
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
          <p className="text-sm">
            <span className="text-muted">Hypothesis: </span>
            {report.hypothesis}
          </p>
        )}
        <div className="text-[13px] text-muted">
          Baseline {report.baseline_start} → {report.baseline_end} · Intervention{" "}
          {report.intervention_start} → {report.intervention_end}
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Outcomes</h3>
        {comparisons.map((c) => (
          <OutcomeChart key={c.outcome_id} c={c} />
        ))}
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card>
          <h3 className="mt-0 font-semibold">What changed</h3>
          {report.what_changed.length === 0 ? (
            <p className="text-sm text-muted">Nothing notable.</p>
          ) : (
            <ul className="list-disc pl-[18px] text-sm">
              {report.what_changed.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="mt-0 font-semibold">What did not change</h3>
          {report.what_did_not_change.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="list-disc pl-[18px] text-sm">
              {report.what_did_not_change.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Confounders</h3>
        <ConfounderList items={report.confounders} />
      </Card>

      {report.meal_examples.length > 0 && (
        <Card className="mb-4">
          <h3 className="mt-0 font-semibold">Meal examples</h3>
          {report.meal_examples.map((m, i) => (
            <div key={i} className="mb-1.5 text-sm">
              <Badge tone="neutral">{m.phase}</Badge> <span>{m.description}</span>
            </div>
          ))}
        </Card>
      )}

      <Card className="mb-4 border-accent bg-accent-soft">
        <h3 className="mt-0 font-semibold">Recommendation</h3>
        <p className="m-0 text-[15px]">{report.recommendation}</p>
        <p className="mb-0 text-[13px] text-muted">Decision: {report.decision}</p>
      </Card>

      <Card>
        <h3 className="mt-0 text-sm text-muted">CAVEATS</h3>
        <ul className="list-disc pl-[18px] text-[13px] text-muted">
          {report.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
