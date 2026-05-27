"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, KeyRound, Lock, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PRINCIPLES: [string, string][] = [
  ["No selling, no ads, no third-party analytics.", "principle"],
  ["We make no medical claims. Not a diagnostic tool.", "principle"],
  ["You can export everything as JSON any time.", "right"],
  ["You can delete everything. No soft-delete, no backup.", "right"],
];

export default function AccountPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const [confirm, setConfirm] = useState("");
  const [deleted, setDeleted] = useState<Record<string, number> | null>(null);

  const exportData = useMutation({
    mutationFn: api.exportAccount,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutrition-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const wipe = useMutation({
    mutationFn: api.deleteAccountData,
    onSuccess: (res) => {
      setDeleted(res.deleted);
      setConfirm("");
      qc.invalidateQueries();
    },
  });

  return (
    <>
      <TopBar breadcrumb={["Settings"]} title="Account & privacy" eyebrow="Quiet utility" />

      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <Card eyebrow="Account" title="Identity">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input value={me?.display_name ?? ""} readOnly />
            </Field>
            <Field label="Email">
              <Input value={me?.email ?? ""} readOnly suffix={<Badge tone="improved" size="sm">signed in</Badge>} />
            </Field>
          </div>
        </Card>

        <Card eyebrow="Privacy" title="Where your data lives" actions={<Badge tone="ghost" icon={Lock}>Private</Badge>}>
          <p className="mb-4 mt-0 font-display text-[18px] italic leading-[1.45] text-ink-2">
            Your notebook is yours. We store the minimum needed to run your
            experiments — and treat meals, weight, and symptoms as sensitive
            health data.
          </p>
          <ul className="m-0 list-none border-t border-line p-0">
            {PRINCIPLES.map(([text, kind]) => (
              <li key={text} className="flex items-start gap-3 border-b border-line py-2.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-improved" />
                <span className="flex-1 text-[13px] text-ink">{text}</span>
                <span className="label shrink-0">{kind}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">
            Full detail on the <Link href="/privacy" className="text-signal-ink">privacy page</Link>.
          </p>
        </Card>

        <ChangePassword />

        <Card eyebrow="Data" title="Export">
          <div className="flex items-center justify-between gap-6">
            <p className="m-0 max-w-[460px] text-[13px] leading-[1.55] text-ink-2">
              Download everything you&apos;ve entered — experiments, logs, meals,
              confounders, and analysis snapshots — as a single JSON file.
              Reports export to PDF from each experiment.
            </p>
            <Button variant="secondary" size="md" icon={Download} onClick={() => exportData.mutate()} disabled={exportData.isPending}>
              {exportData.isPending ? "Preparing…" : "Export JSON"}
            </Button>
          </div>
          {exportData.error && <p className="mt-2 text-[12px] text-worsened">Export failed.</p>}
        </Card>

        <Card eyebrow="Danger zone" title="Delete all data" className="border-worsened-line">
          <p className="m-0 mb-4 text-[13px] leading-[1.55] text-ink-2">
            Permanently removes every experiment, log, confounder, and meal.{" "}
            <strong className="font-medium text-ink">This cannot be undone.</strong>{" "}
            Type <span className="font-mono text-ink">DELETE</span> to confirm.
          </p>
          <div className="flex items-center gap-2.5">
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" className="max-w-[180px]" />
            <Button variant="danger" size="md" icon={Trash2} disabled={confirm !== "DELETE" || wipe.isPending} onClick={() => wipe.mutate()}>
              {wipe.isPending ? "Deleting…" : "Delete everything"}
            </Button>
          </div>
          {deleted && (
            <p className="mt-3 text-[13px] text-improved">
              Deleted {Object.values(deleted).reduce((a, b) => a + b, 0)} rows. Your account is now empty.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
      setTimeout(() => setDone(false), 3000);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not change password."),
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm;

  return (
    <Card eyebrow="Security" title="Change password" actions={<Badge tone="ghost" icon={KeyRound}>Revokes other sessions</Badge>}>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) change.mutate();
        }}
      >
        <Field label="Current">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New" hint="≥ 8 chars">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm" error={mismatch ? "doesn't match" : undefined}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" variant="secondary" size="md" disabled={!canSubmit || change.isPending}>
            {change.isPending ? "Updating…" : "Update password"}
          </Button>
          {done && <span className="ml-3 text-[13px] text-improved">Password updated.</span>}
          {error && <span className="ml-3 text-[13px] text-worsened">{error}</span>}
        </div>
      </form>
    </Card>
  );
}
