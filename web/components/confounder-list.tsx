"use client";

import type { Confounder } from "@/lib/api";
import { Badge } from "./ui";

export function ConfounderList({ items }: { items: Confounder[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No confounders logged.</p>;
  }
  return (
    <div>
      {items.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2.5 border-b border-line py-2"
        >
          <span className="w-[90px] text-[13px] text-muted">{c.date}</span>
          <Badge
            tone={
              c.severity === "high"
                ? "bad"
                : c.severity === "medium"
                  ? "warn"
                  : "neutral"
            }
          >
            {c.severity}
          </Badge>
          <span className="text-sm">{c.kind.replace("_", " ")}</span>
          {c.notes && (
            <span className="text-[13px] text-muted">— {c.notes}</span>
          )}
        </div>
      ))}
    </div>
  );
}
