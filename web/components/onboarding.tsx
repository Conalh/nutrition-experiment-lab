"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button, Card } from "./ui";

const STEPS = [
  {
    n: 1,
    title: "Design it",
    body: "Ask one clear question and change one thing — a baseline window, then an intervention.",
  },
  {
    n: 2,
    title: "Log each day",
    body: "Rate hunger, energy, sleep, and more in under a minute. Note adherence and any confounders.",
  },
  {
    n: 3,
    title: "Read the result",
    body: "Get an honest readout: what changed, whether to trust it, and what to do next.",
  },
];

export function Onboarding() {
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
    <Card className="mt-2">
      <h2 className="mt-0 text-lg font-semibold">Welcome to your lab notebook</h2>
      <p className="text-sm text-muted">
        Run a structured n-of-1 experiment to learn how one food change affects
        how you feel — not a diet, not medical advice.
      </p>

      <div className="my-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-lg border border-line bg-surface p-3.5">
            <div className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
              {s.n}
            </div>
            <div className="font-medium">{s.title}</div>
            <div className="mt-1 text-[13px] text-muted">{s.body}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/experiments/new">
          <Button>Create your first experiment</Button>
        </Link>
        <Button
          variant="ghost"
          onClick={() => loadDemo.mutate()}
          disabled={loadDemo.isPending}
        >
          {loadDemo.isPending ? "Loading…" : "Load a demo experiment"}
        </Button>
        {loadDemo.error && (
          <span className="text-sm text-bad">Could not load the demo.</span>
        )}
      </div>
      <p className="mb-0 mt-2.5 text-xs text-muted">
        The demo is a finished experiment with three weeks of data — explore the
        analysis and report, then delete it any time from Account.
      </p>
    </Card>
  );
}
