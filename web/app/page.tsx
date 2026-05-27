"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ExperimentCard } from "@/components/experiment-card";
import { Button } from "@/components/ui";

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Experiments
          </h1>
          <p style={{ color: "var(--text-dim)", margin: "4px 0 0" }}>
            Run one clean nutrition question at a time.
          </p>
        </div>
        <Link href="/experiments/new">
          <Button>+ New experiment</Button>
        </Link>
      </div>

      {isLoading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}
      {error && (
        <p style={{ color: "var(--bad)" }}>
          Could not reach the API. Is the backend running on :8000?
        </p>
      )}

      {!isLoading && experiments.length === 0 && (
        <div style={{ color: "var(--text-dim)", marginTop: 40 }}>
          No experiments yet. Create your first one to get started.
        </div>
      )}

      {active.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 10 }}>
            ACTIVE & DRAFT
          </h2>
          {active.map((e) => (
            <ExperimentCard key={e.id} exp={e} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 10 }}>
            COMPLETED LIBRARY
          </h2>
          {done.map((e) => (
            <ExperimentCard key={e.id} exp={e} />
          ))}
        </section>
      )}
    </div>
  );
}
