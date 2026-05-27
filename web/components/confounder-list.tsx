"use client";

import type { Confounder } from "@/lib/api";
import { Badge } from "./ui";

export function ConfounderList({ items }: { items: Confounder[] }) {
  if (items.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
        No confounders logged.
      </p>
    );
  }
  return (
    <div>
      {items.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text-dim)", fontSize: 13, width: 90 }}>
            {c.date}
          </span>
          <Badge
            tone={c.severity === "high" ? "bad" : c.severity === "medium" ? "warn" : "neutral"}
          >
            {c.severity}
          </Badge>
          <span style={{ fontSize: 14 }}>{c.kind.replace("_", " ")}</span>
          {c.notes && (
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
              — {c.notes}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
