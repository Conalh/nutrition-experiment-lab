"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { api, type OutcomeComparison } from "@/lib/api";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Loading, ErrorState } from "@/components/states";

function findingSentence(p: OutcomeComparison | null): React.ReactNode {
  if (!p || p.baseline_mean == null || p.intervention_mean == null) {
    return "There wasn't enough clean data to reach a confident finding.";
  }
  const delta = Math.abs(p.absolute_change ?? 0).toFixed(1);
  const unit = p.kind === "rating" ? " points on a 1–5 scale" : "";
  if (p.result === "improved") {
    const verb = p.direction === "lower_better" ? "fell" : "rose";
    return (
      <>
        {p.name} {verb} <em className="not-italic text-improved">{delta}{unit}</em> during the intervention window.
      </>
    );
  }
  if (p.result === "worsened") {
    return <>{p.name} moved <em className="not-italic text-worsened">the wrong way</em> during the intervention window.</>;
  }
  if (p.result === "unchanged") {
    return <>{p.name} did not move meaningfully between the two windows.</>;
  }
  return <>{p.name} could not be called — not enough data.</>;
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: report, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => api.getReport(id),
  });

  if (isLoading)
    return (
      <div className="theme-light flex h-screen w-screen items-center justify-center bg-bg-sunken">
        <Loading />
      </div>
    );
  if (error || !report)
    return (
      <div className="theme-light flex h-screen w-screen items-center justify-center bg-bg-sunken p-10">
        <ErrorState message="Could not load report." />
      </div>
    );

  const primary = report.primary_outcome;
  const adh = Math.round(report.adherence.adherence_rate * 100);

  return (
    <div className="theme-light h-screen w-screen overflow-auto bg-bg-sunken">
      {/* Toolbar (hidden in print) */}
      <div className="mx-auto flex max-w-[820px] items-center justify-between px-14 pt-6 print:hidden">
        <Link href={`/experiments/${id}`} className="inline-flex items-center gap-1.5 text-[12px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Experiment
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
          <a href={api.reportPdfUrl(id)} target="_blank" rel="noreferrer">
            <Button variant="primary" size="sm" icon={Download}>Download PDF</Button>
          </a>
        </div>
      </div>

      <div className="px-14 py-8">
        <article className="mx-auto max-w-[820px] border border-line bg-surface px-[72px] py-16 shadow-[0_10px_60px_-20px_rgba(0,0,0,0.15)]">
          {/* Masthead */}
          <header className="mb-9 flex items-end justify-between border-b-2 border-ink pb-5">
            <div>
              <Wordmark size={18} />
              <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-(--tracking-label) text-ink-3">
                Notebook report
              </span>
            </div>
            <div className="text-right font-mono text-[10px] text-ink-3">
              <div>Status · {report.status}</div>
              <div>Decision · {report.decision}</div>
            </div>
          </header>

          {/* Title */}
          <section className="mb-8">
            <span className="label mb-2 block">The question</span>
            <h1 className="m-0 mb-3 font-display text-[40px] font-normal leading-[1.08] tracking-(--tracking-display) text-ink">
              {report.question}
            </h1>
            {report.hypothesis && (
              <p className="m-0 font-display text-[16px] italic leading-[1.5] text-ink-2">{report.hypothesis}</p>
            )}
            <p className="mt-2 font-mono text-[11px] text-ink-3">
              Baseline {report.baseline_start} → {report.baseline_end} · Intervention {report.intervention_start} → {report.intervention_end}
            </p>
          </section>

          {/* Finding */}
          <section className="mb-8 border border-line-2 border-l-[3px] border-l-signal bg-surface-3 p-6">
            <span className="label mb-2 block">Finding</span>
            <p className="m-0 font-display text-[22px] leading-[1.35] tracking-(--tracking-tight) text-ink">
              {findingSentence(primary)}
            </p>
            <div className="mt-5 flex flex-wrap gap-8 border-t border-line-2 pt-4">
              {primary?.absolute_change != null && (
                <Pair
                  label="Δ Primary"
                  value={`${primary.absolute_change > 0 ? "+" : ""}${primary.absolute_change}`}
                  className={primary.result === "improved" ? "text-improved" : primary.result === "worsened" ? "text-worsened" : ""}
                />
              )}
              <Pair label="Confidence" value={report.confidence} upper />
              <Pair label="Adherence" value={<>{adh}<span className="text-[12px]">%</span></>} />
              {primary && <Pair label="n / window" value={`${primary.baseline_n}/${primary.intervention_n}`} />}
            </div>
          </section>

          {/* What changed / didn't */}
          <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <DeltaList title="What changed" items={report.what_changed} improved />
            <DeltaList title="What didn't" items={report.what_did_not_change} />
          </div>

          {/* Confounders */}
          {report.confounders.length > 0 && (
            <section className="mb-8">
              <span className="label mb-3 block">Confounders</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {report.confounders.map((c) => (
                  <div key={c.id} className="rounded-sm border border-line-2 p-3.5">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="font-mono text-[11px] text-ink-2">{c.date}</span>
                      <span className="font-mono text-[10px] uppercase tracking-(--tracking-label) text-ink-3">{c.severity}</span>
                    </div>
                    <div className="text-[13px] text-ink">{c.kind.replace(/_/g, " ")}</div>
                    {c.notes && <div className="mt-1 font-mono text-[11px] text-ink-3">{c.notes}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recommendation */}
          <section className="mb-8">
            <span className="label mb-3 block">Recommendation</span>
            <p className="m-0 font-display text-[18px] leading-[1.55] text-ink">{report.recommendation}</p>
          </section>

          {/* Meals */}
          {report.meal_examples.length > 0 && (
            <section className="mb-8">
              <span className="label mb-3 block">Sample meals</span>
              <ul className="m-0 grid grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                {report.meal_examples.map((m, i) => (
                  <li key={i} className="flex list-none justify-between border-b border-line py-1.5 text-[13px] text-ink">
                    <span>{m.description}</span>
                    <span className="font-mono text-[11px] text-signal-ink">{m.phase}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Caveats */}
          <section className="mb-6 border border-line-2 p-[18px]">
            <span className="label mb-2 block">Caveats</span>
            <ul className="m-0 list-disc pl-4 text-[12px] leading-[1.65] text-ink-2">
              {report.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </section>

          <footer className="flex items-center justify-between border-t border-ink pt-4 font-mono text-[10px] uppercase tracking-(--tracking-label) text-ink-3">
            <span>Generated by Nutrition Lab</span>
            <span>private · non-clinical</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Pair({ label, value, className, upper }: { label: string; value: React.ReactNode; className?: string; upper?: boolean }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className={`mt-1.5 font-mono font-medium text-ink ${upper ? "text-[16px] uppercase tracking-(--tracking-label)" : "text-[24px]"} ${className ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

function DeltaList({ title, items, improved }: { title: string; items: string[]; improved?: boolean }) {
  return (
    <section>
      <span className="label mb-2 block">{title}</span>
      {items.length === 0 ? (
        <p className="m-0 border-t border-line-2 py-2.5 text-[13px] text-ink-3">—</p>
      ) : (
        <ul className="m-0 list-none border-t border-line-2 p-0">
          {items.map((s, i) => (
            <li key={i} className={`border-b border-line-2 py-2.5 text-[13px] ${improved ? "text-ink" : "text-ink-2"}`}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
