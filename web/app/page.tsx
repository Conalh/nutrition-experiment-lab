"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  NotebookPen,
  Plus,
} from "lucide-react";
import { api, type Experiment } from "@/lib/api";
import { TopBar } from "@/components/nav/top-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/viz/stat";
import { Loading, ErrorState } from "@/components/states";

export default function LabPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.listExperiments,
  });

  if (isLoading) {
    return (
      <>
        <TopBar title="Lab" />
        <Loading />
      </>
    );
  }
  if (error) {
    return (
      <>
        <TopBar title="Lab" />
        <div className="p-10">
          <ErrorState message="Could not reach the API." hint="Is the backend running?" />
        </div>
      </>
    );
  }

  const exps = data ?? [];
  return exps.length === 0 ? <ZeroState /> : <Populated exps={exps} />;
}

// ─── Zero-state / onboarding ─────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Design it", body: "Question · baseline · intervention · outcomes.", Icon: FlaskConical },
  { n: "02", title: "Log each day", body: "Under a minute. 1–5 ratings, adherence, notes.", Icon: NotebookPen },
  { n: "03", title: "Read the result", body: "Plain-language finding, confidence, what to do next.", Icon: BookOpen },
];

function ZeroState() {
  const qc = useQueryClient();
  const router = useRouter();
  const loadDemo = useMutation({
    mutationFn: api.seedDemo,
    onSuccess: ({ experiment_id }) => {
      qc.invalidateQueries({ queryKey: ["experiments"] });
      router.push(`/experiments/${experiment_id}`);
    },
  });

  return (
    <>
      <TopBar title="Lab" eyebrow="Welcome to your lab notebook" />
      <div className="flex-1 overflow-y-auto p-10">
        <div className="relative overflow-hidden rounded-sm border border-line bg-surface px-12 py-10">
          <span aria-hidden className="nl-corner nl-corner-tl" />
          <span aria-hidden className="nl-corner nl-corner-tr" />
          <span aria-hidden className="nl-corner nl-corner-bl" />
          <span aria-hidden className="nl-corner nl-corner-br" />

          <div className="flex flex-col items-start gap-16 lg:flex-row">
            <div className="flex-1">
              <span className="label mb-3 block">First-run · The loop</span>
              <h2 className="m-0 mb-4 font-display text-[48px] font-normal leading-[1.05] tracking-(--tracking-display)">
                Treat your body like
                <br />
                <em className="text-signal-ink">a single subject.</em>
              </h2>
              <p className="mb-7 max-w-[480px] font-display text-[18px] italic leading-[1.5] text-ink-2">
                Ask one specific question, change one thing, and watch the
                noise. The lab does the math; you do the noticing.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/experiments/new">
                  <Button variant="primary" size="lg" icon={Plus}>
                    Create your first experiment
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => loadDemo.mutate()}
                  disabled={loadDemo.isPending}
                >
                  {loadDemo.isPending ? "Loading…" : "Load a demo experiment"}
                </Button>
              </div>
              {loadDemo.error && (
                <p className="mt-3 text-[12px] text-worsened">Could not load the demo.</p>
              )}
            </div>

            <ol className="flex w-full max-w-[380px] flex-col rounded-sm border border-line p-1">
              {STEPS.map(({ n, title, body, Icon }, i) => (
                <li
                  key={n}
                  className={`flex items-start gap-4 p-4 ${i < 2 ? "border-b border-line" : ""}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-line-2 bg-surface-3 text-signal">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] text-signal-ink">{n}</span>
                      <span className="text-[15px] font-medium text-ink">{title}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-[1.5] text-ink-3">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Populated ───────────────────────────────────────────────────────
function Populated({ exps }: { exps: Experiment[] }) {
  const active = exps.filter((e) => ["active", "paused"].includes(e.status)).length;
  const drafts = exps.filter((e) => e.status === "draft").length;
  const completed = exps.filter((e) => ["completed", "abandoned"].includes(e.status)).length;

  return (
    <>
      <TopBar
        title="Lab"
        eyebrow={`${exps.length} experiment${exps.length === 1 ? "" : "s"} · ${active} active`}
        actions={
          <Link href="/experiments/new">
            <Button variant="primary" size="sm" icon={Plus}>
              New experiment
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-7">
        <section className="mb-6 grid grid-cols-3 rounded-sm border border-line bg-surface p-6">
          <Stat label="Active" value={active} />
          <Stat label="Drafts" value={drafts} />
          <Stat label="Completed" value={completed} />
        </section>

        <div className="border border-line bg-surface">
          {exps.map((e) => (
            <Row key={e.id} exp={e} />
          ))}
        </div>

        <footer className="px-1 py-3.5 font-mono text-[11px] text-ink-4">
          Showing {exps.length} of {exps.length} · sorted by recency
        </footer>
      </div>
    </>
  );
}

const STATUS_BADGE: Record<
  string,
  { tone: "signal" | "neutral" | "ghost" | "improved" | "worsened"; label: string }
> = {
  active: { tone: "signal", label: "Active" },
  paused: { tone: "ghost", label: "Paused" },
  draft: { tone: "ghost", label: "Draft" },
  completed: { tone: "neutral", label: "Completed" },
  abandoned: { tone: "neutral", label: "Stopped" },
};

function Row({ exp }: { exp: Experiment }) {
  const badge = STATUS_BADGE[exp.status] ?? STATUS_BADGE.draft;
  const cta =
    exp.status === "completed"
      ? "Read"
      : exp.status === "draft"
        ? "Continue"
        : "Open";
  return (
    <Link
      href={`/experiments/${exp.id}`}
      className="grid items-center gap-4 border-t border-line px-5 py-[18px] transition-colors duration-(--duration-swift) hover:bg-surface-2 [&:first-child]:border-t-0"
      style={{ gridTemplateColumns: "1fr 130px 90px" }}
    >
      <div className="min-w-0">
        <div className="truncate font-display text-[20px] tracking-tight text-ink">
          {exp.title}
        </div>
        <div className="mt-0.5 truncate font-display text-[12px] italic text-ink-3">
          {exp.question}
        </div>
      </div>
      <div>
        <Badge tone={badge.tone} dot>
          {badge.label}
        </Badge>
      </div>
      <div className="flex items-center justify-end gap-1 font-mono text-[11px] text-ink-3">
        {cta}
        <ArrowRight className="size-[12px]" />
      </div>
    </Link>
  );
}
