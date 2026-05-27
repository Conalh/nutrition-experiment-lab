"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { api, type Adherence } from "@/lib/api";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RatingGroup } from "@/components/ui/rating-group";
import { Segmented } from "@/components/ui/segmented";
import { Loading } from "@/components/states";

const RATINGS = [
  { key: "hunger", label: "Hunger", sub: "afternoon, 2–5pm", labels: ["none", "low", "mid", "high", "peak"] },
  { key: "energy", label: "Energy", sub: "afternoon", labels: ["flat", "low", "mid", "good", "peak"] },
  { key: "digestion", label: "Digestion", sub: "today", labels: ["rough", "off", "ok", "good", "easy"] },
  { key: "sleep_quality", label: "Sleep quality", sub: "last night", labels: ["poor", "fair", "ok", "good", "great"] },
  { key: "training_performance", label: "Training", sub: "if you trained", labels: ["poor", "weak", "ok", "strong", "pr"] },
] as const;

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
  const active = (experiments ?? []).filter((e) => ["active", "paused"].includes(e.status));

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

  if (isLoading) {
    return (
      <>
        <TopBar title="Daily log" />
        <Loading />
      </>
    );
  }

  if (active.length === 0) {
    return (
      <>
        <TopBar title="Daily log" />
        <div className="flex-1 overflow-y-auto p-10">
          <Card>
            <p className="m-0 text-[13px] text-ink-2">
              No active experiment to log against. Start one from the{" "}
              <span className="text-signal-ink">Lab</span> and the daily log opens up here.
            </p>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Daily log"
        eyebrow="Under a minute"
        actions={
          <Button variant="primary" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save day"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Experiment">
            <Select value={expId} onChange={(e) => setExpId(e.target.value)}>
              {active.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <Card eyebrow="Daily readings" title="How did today feel?" actions={<span className="font-mono text-[11px] text-ink-3">1–5 to rate</span>}>
            <div className="flex flex-col gap-[18px]">
              {RATINGS.map((r) => (
                <div key={r.key} className="grid items-center gap-4" style={{ gridTemplateColumns: "150px 1fr" }}>
                  <div>
                    <div className="text-[13px] font-medium text-ink">{r.label}</div>
                    <div className="text-[11px] text-ink-3">{r.sub}</div>
                  </div>
                  <RatingGroup
                    value={form[r.key] ?? null}
                    onChange={(v) => setForm((f) => ({ ...f, [r.key]: v }))}
                    labels={r.labels as unknown as string[]}
                    ariaLabel={`${r.label} rating, 1 to 5`}
                  />
                </div>
              ))}
            </div>

            <hr className="nl-rule my-5" />

            <div className="mb-4 grid items-center gap-4" style={{ gridTemplateColumns: "150px 1fr" }}>
              <div>
                <div className="text-[13px] font-medium text-ink">Adherence</div>
                <div className="text-[11px] text-ink-3">followed the rule?</div>
              </div>
              <Segmented
                value={adherence || "na"}
                onChange={(v) => setAdherence(v === "na" ? "not_applicable" : (v as Adherence))}
                options={[
                  { value: "yes", label: "Yes", tone: "improved" },
                  { value: "partial", label: "Partial", tone: "signal" },
                  { value: "no", label: "No", tone: "worsened" },
                  { value: "na", label: "N/A" },
                ]}
              />
            </div>

            <div className="grid items-center gap-4" style={{ gridTemplateColumns: "150px 1fr" }}>
              <div>
                <div className="text-[13px] font-medium text-ink">Weight</div>
                <div className="text-[11px] text-ink-3">optional</div>
              </div>
              <Input mono value={weight} onChange={(e) => setWeight(e.target.value)} suffix="kg" placeholder="—" />
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card eyebrow="Meal" title="What did you eat?">
              <div className="flex items-center gap-2">
                <Input value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="Greek yogurt, whey, berries" prefix={<Plus className="size-3" />} />
              </div>
              <p className="mt-2 text-[11px] text-ink-3">Added when you save the day.</p>
            </Card>

            <Card eyebrow="Notes" title="Anything notable?">
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Less hunger around 3pm. Bigger salad at lunch." />
            </Card>
          </div>
        </div>

        <footer className="mt-6 flex items-center justify-between rounded-sm border border-line bg-surface px-5 py-3.5">
          <span className="inline-flex items-center gap-2 text-[12px] text-ink-3">
            {saved && <Check className="size-3.5 text-improved" />}
            {saved ? "Saved" : "Not saved yet"}
            {save.error && <span className="text-worsened">· {save.error instanceof Error ? save.error.message : "error"}</span>}
          </span>
          <Button variant="primary" size="md" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save day"}
          </Button>
        </footer>
      </div>
    </>
  );
}
