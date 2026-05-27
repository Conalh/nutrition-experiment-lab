"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await api.signup(email, password);
      else await api.login(email, password);
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 pt-20">
      <h1 className="mb-1 text-2xl font-bold text-accent">Nutrition Lab</h1>
      <p className="mb-5 text-sm text-muted">
        A private lab notebook for n-of-1 nutrition experiments.
      </p>

      <Card>
        <h2 className="mt-0 text-lg font-semibold">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h2>
        <form onSubmit={submit}>
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Password"
            hint={mode === "signup" ? "At least 8 characters." : undefined}
          >
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <p className="mb-3 text-sm text-bad">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? "No account yet? " : "Already have an account? "}
        <button
          type="button"
          className="text-accent"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
