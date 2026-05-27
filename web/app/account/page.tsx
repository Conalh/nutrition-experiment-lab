"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button, Card } from "@/components/ui";

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
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Account</h1>
      <p style={{ color: "var(--text-dim)", marginTop: 0 }}>
        Your data, your controls. See the{" "}
        <Link href="/privacy" style={{ color: "var(--accent)" }}>
          privacy page
        </Link>{" "}
        for details.
      </p>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Export your data</h3>
        <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
          Download everything you&apos;ve entered as a single JSON file.
        </p>
        <Button onClick={() => exportData.mutate()} disabled={exportData.isPending}>
          {exportData.isPending ? "Preparing…" : "Export JSON"}
        </Button>
        {exportData.error && (
          <p style={{ color: "var(--bad)" }}>Export failed.</p>
        )}
      </Card>

      <Card style={{ borderColor: "var(--bad)" }}>
        <h3 style={{ marginTop: 0, color: "var(--bad)" }}>Delete all data</h3>
        <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
          Permanently deletes every experiment, log, meal, and confounder. This
          cannot be undone. Type <strong>DELETE</strong> to confirm.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              color: "var(--text)",
            }}
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
          <p style={{ color: "var(--accent)", fontSize: 14 }}>
            Deleted{" "}
            {Object.values(deleted).reduce((a, b) => a + b, 0)} rows. Your
            account is now empty.
          </p>
        )}
      </Card>
    </div>
  );
}
