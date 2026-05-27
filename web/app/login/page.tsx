"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Wordmark } from "@/components/brand/wordmark";
import { Button, ContinueButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-stretch overflow-hidden bg-bg">
      {/* Editorial panel */}
      <aside className="relative hidden flex-[1.1] flex-col justify-between border-r border-line bg-bg-sunken p-14 md:flex">
        <Wordmark size={20} />

        <div>
          <span className="label mb-4 block">Lab manual · 01</span>
          <h1 className="m-0 font-display text-[72px] font-normal leading-[1.02] tracking-(--tracking-display) text-ink">
            One question.
            <br />
            <em className="text-signal-ink">One protocol.</em>
            <br />
            One honest reading.
          </h1>
          <p className="mt-6 max-w-[460px] font-display text-[20px] italic leading-[1.45] text-ink-2">
            A private notebook for running n-of-1 nutrition experiments. Define
            a baseline. Define a change. Measure what moves.
          </p>
        </div>

        <div className="flex gap-8 text-[12px] text-ink-3">
          <span><span className="font-mono text-signal-ink">01</span> Design</span>
          <span><span className="font-mono text-signal-ink">02</span> Log</span>
          <span><span className="font-mono text-signal-ink">03</span> Read</span>
        </div>

        <span aria-hidden className="nl-corner nl-corner-tl" style={{ width: 14, height: 14, top: 24, left: 24 }} />
        <span aria-hidden className="nl-corner nl-corner-br" style={{ width: 14, height: 14, bottom: 24, right: 24 }} />
      </aside>

      {/* Form */}
      <section className="flex max-w-[560px] flex-1 flex-col justify-center p-10 sm:p-14">
        <div className="mb-9">
          <span className="label mb-3 block">
            {mode === "login" ? "Sign in" : "Open a notebook"}
          </span>
          <h2 className="m-0 font-display text-[40px] font-normal tracking-(--tracking-tight)">
            {mode === "login" ? "Return to the bench." : "Start your notebook."}
          </h2>
        </div>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              prefix={<User className="size-3" />}
              required
            />
          </Field>

          <Field
            label="Password"
            hint={mode === "signup" ? "at least 8 characters" : undefined}
          >
            <Input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              prefix={<Lock className="size-3" />}
              required
            />
          </Field>

          {error && <p className="m-0 text-[12px] text-worsened">{error}</p>}

          <ContinueButton size="lg" full type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </ContinueButton>
        </form>

        <p className="mt-9 text-[12px] leading-[1.6] text-ink-3">
          {mode === "login" ? "New to the lab? " : "Already have a notebook? "}
          <button
            type="button"
            className="border-b border-signal-line text-signal-ink"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
          . We never sell data, never run ads, and make no medical claims.
        </p>
      </section>
    </div>
  );
}
