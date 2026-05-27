"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ExperimentCard } from "@/components/experiment-card";
import { Button } from "@/components/ui";
import { ErrorState, Loading } from "@/components/states";
import { Onboarding } from "@/components/onboarding";

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.listExperiments,
  });

  const experiments = data ?? [];
  const active = experiments.filter((e) =>
    ["active", "paused", "draft"].includes(e.status),
  );
  const done = experiments.filter((e) =>
    ["completed", "abandoned"].includes(e.status),
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Experiments</h1>
          <p className="mt-1 text-muted">
            Run one clean nutrition question at a time.
          </p>
        </div>
        <Link href="/experiments/new">
          <Button>+ New experiment</Button>
        </Link>
      </div>

      {isLoading && <Loading />}
      {error && (
        <ErrorState
          message="Could not reach the API."
          hint="Is the backend running on :8000?"
        />
      )}

      {!isLoading && !error && experiments.length === 0 && <Onboarding />}

      {active.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2.5 text-sm text-muted">ACTIVE &amp; DRAFT</h2>
          {active.map((e) => (
            <ExperimentCard key={e.id} exp={e} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-sm text-muted">COMPLETED LIBRARY</h2>
          {done.map((e) => (
            <ExperimentCard key={e.id} exp={e} />
          ))}
        </section>
      )}
    </div>
  );
}
