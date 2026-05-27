"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button, Card, inputClass } from "@/components/ui";

export default function AccountPage() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [deleted, setDeleted] = useState<Record<string, number> | null>(null);

  const exportData = useMutation({
    mutationFn: api.exportAccount,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutrition-lab-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
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
    <div>
      <h1 className="text-2xl font-bold">Account</h1>
      <p className="mt-0 text-muted">
        Your data, your controls. See the{" "}
        <Link href="/privacy" className="text-accent">
          privacy page
        </Link>{" "}
        for details.
      </p>

      <Card className="mb-4">
        <h3 className="mt-0 font-semibold">Export your data</h3>
        <p className="text-sm text-muted">
          Download everything you&apos;ve entered as a single JSON file.
        </p>
        <Button onClick={() => exportData.mutate()} disabled={exportData.isPending}>
          {exportData.isPending ? "Preparing…" : "Export JSON"}
        </Button>
        {exportData.error && <p className="text-bad">Export failed.</p>}
      </Card>

      <Card tone="danger">
        <h3 className="mt-0 font-semibold text-bad">Delete all data</h3>
        <p className="text-sm text-muted">
          Permanently deletes every experiment, log, meal, and confounder. This
          cannot be undone. Type <strong>DELETE</strong> to confirm.
        </p>
        <div className="flex items-center gap-2.5">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            className={`${inputClass} max-w-[160px]`}
          />
          <Button
            variant="danger"
            disabled={confirm !== "DELETE" || wipe.isPending}
            onClick={() => wipe.mutate()}
          >
            {wipe.isPending ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
        {deleted && (
          <p className="text-sm text-accent">
            Deleted {Object.values(deleted).reduce((a, b) => a + b, 0)} rows.
            Your account is now empty.
          </p>
        )}
      </Card>
    </div>
  );
}
