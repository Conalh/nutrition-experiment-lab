"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Adherence } from "@/lib/api";
import { Button, Card, Field, inputStyle } from "@/components/ui";

const RATINGS: { key: string; label: string }[] = [
  { key: "hunger", label: "Hunger" },
  { key: "energy", label: "Energy" },
  { key: "digestion", label: "Digestion" },
  { key: "sleep_quality", label: "Sleep quality" },
  { key: "training_performance", label: "Training" },
];

const ADHERENCE: Adherence[] = ["yes", "partial", "no", "not_applicable"];

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
      <div style={{ width: 150, color: "var(--text-dim)", fontSize: 14 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: value === n ? "var(--accent)" : "var(--surface-2)",
              color: value === n ? "#0a0d10" : "var(--text)",
              cursor: "pointer",
              fontWeight: value === n ? 700 : 400,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DailyLogPage() {
  const qc = useQueryClient();
  const [expId, setExpId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<Record<string, number | null>>({});
  const [adherence, setAdherence] = useState<Adherence | "">("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [meal, setMeal] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: experiments } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.listExperiments,
  });
  const active = (experiments ?? []).filter((e) =>
    ["active", "paused"].includes(e.status),
  );

  useEffect(() => {
    if (!expId && active.length > 0) setExpId(active[0].id);
  }, [active, expId]);

  // Load any existing log for this experiment+date.
  const { data: existing } = useQuery({
    queryKey: ["daily-log", expId, date],
    queryFn: () => api.getDailyLog(expId, date),
    enabled: !!expId,
    retry: false,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        hunger: existing.hunger,
        energy: existing.energy,
        digestion: existing.digestion,
        sleep_quality: existing.sleep_quality,
        training_performance: existing.training_performance,
      });
      setAdherence(existing.adherence ?? "");
      setWeight(existing.body_weight?.toString() ?? "");
      setNotes(existing.notes ?? "");
    } else {
      setForm({});
      setAdherence("");
      setWeight("");
      setNotes("");
    }
  }, [existing, expId, date]);

  const save = useMutation({
    mutationFn: async () => {
      const log = await api.upsertDailyLog({
        experiment_id: expId,
        date,
        adherence: adherence || null,
        hunger: form.hunger ?? null,
        energy: form.energy ?? null,
        digestion: form.digestion ?? null,
        sleep_quality: form.sleep_quality ?? null,
        training_performance: form.training_performance ?? null,
        body_weight: weight ? parseFloat(weight) : null,
        notes: notes || null,
      });
      if (meal.trim()) {
        await api.addMeal(log.id, { description: meal, tags: [] });
        setMeal("");
      }
      return log;
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["daily-log", expId, date] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (active.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Daily log</h1>
        <p style={{ color: "var(--text-dim)" }}>
          No active experiment. Start one to begin logging.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        Daily log
      </h1>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <Field label="Experiment">
            <select style={inputStyle} value={expId} onChange={(e) => setExpId(e.target.value)}>
              {active.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>How did today feel? (1–5)</h3>
        {RATINGS.map((r) => (
          <RatingRow
            key={r.key}
            label={r.label}
            value={form[r.key] ?? null}
            onChange={(v) => setForm((f) => ({ ...f, [r.key]: v }))}
          />
        ))}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Field label="Adherence to the intervention">
          <div style={{ display: "flex", gap: 8 }}>
            {ADHERENCE.map((a) => (
              <button
                key={a}
                onClick={() => setAdherence(a)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: adherence === a ? "var(--accent)" : "var(--surface-2)",
                  color: adherence === a ? "#0a0d10" : "var(--text)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {a.replace("_", " ")}
              </button>
            ))}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <Field label="Body weight (optional)">
            <input style={inputStyle} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" />
          </Field>
          <Field label="Add a meal (optional)">
            <input style={inputStyle} value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Greek yogurt, whey, berries" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea style={{ ...inputStyle, minHeight: 50 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save day"}
        </Button>
        {saved && <span style={{ color: "var(--accent)" }}>Saved ✓</span>}
        {save.error && (
          <span style={{ color: "var(--bad)" }}>
            {save.error instanceof Error ? save.error.message : "Error"}
          </span>
        )}
      </div>
    </div>
  );
}
