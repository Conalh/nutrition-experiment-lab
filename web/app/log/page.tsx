"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Adherence } from "@/lib/api";
import { Button, Card, Field, FieldGroup, inputClass } from "@/components/ui";
import { EmptyState, Loading } from "@/components/states";

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
    <div className="mb-2.5 flex items-center" role="group" aria-label={label}>
      <div className="w-[150px] text-sm text-muted">{label}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${label} ${n}`}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-lg border border-line ${
              value === n
                ? "bg-accent font-bold text-[#0a0d10]"
                : "bg-surface text-ink"
            }`}
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

  const { data: experiments, isLoading } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.listExperiments,
  });
  const active = (experiments ?? []).filter((e) =>
    ["active", "paused"].includes(e.status),
  );

  useEffect(() => {
    if (!expId && active.length > 0) setExpId(active[0].id);
  }, [active, expId]);

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

  if (isLoading) return <Loading />;

  if (active.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Daily log</h1>
        <EmptyState title="No active experiment">
          Start one to begin logging.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Daily log</h1>

      <Card className="mb-4">
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Experiment">
            <select className={inputClass} value={expId} onChange={(e) => setExpId(e.target.value)}>
              {active.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">How did today feel? (1–5)</h3>
        {RATINGS.map((r) => (
          <RatingRow
            key={r.key}
            label={r.label}
            value={form[r.key] ?? null}
            onChange={(v) => setForm((f) => ({ ...f, [r.key]: v }))}
          />
        ))}
      </Card>

      <Card className="mb-4">
        <FieldGroup label="Adherence to the intervention">
          <div className="flex gap-2">
            {ADHERENCE.map((a) => (
              <button
                key={a}
                onClick={() => setAdherence(a)}
                className={`rounded-lg border border-line px-3 py-1.5 text-[13px] ${
                  adherence === a
                    ? "bg-accent text-[#0a0d10]"
                    : "bg-surface text-ink"
                }`}
              >
                {a.replace("_", " ")}
              </button>
            ))}
          </div>
        </FieldGroup>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="Body weight (optional)">
            <input className={inputClass} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" />
          </Field>
          <Field label="Add a meal (optional)">
            <input className={inputClass} value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Greek yogurt, whey, berries" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={`${inputClass} min-h-[50px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save day"}
        </Button>
        {saved && <span className="text-accent">Saved ✓</span>}
        {save.error && (
          <span className="text-bad">
            {save.error instanceof Error ? save.error.message : "Error"}
          </span>
        )}
      </div>
    </div>
  );
}
