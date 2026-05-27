"use client";

import React from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-card p-[18px] ${className}`}
    >
      {children}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-[#0a0d10] font-semibold hover:brightness-110",
  ghost: "border border-line text-ink hover:bg-surface",
  danger: "border border-bad text-bad hover:bg-bad-soft",
} as const;

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BUTTON_VARIANTS;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** A labelled single form control. The <label> wraps the input so clicking
 * the label focuses it — correct for one control, wrong for button groups
 * (see FieldGroup). */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** A labelled group of controls (radio-like buttons). Uses a heading +
 * group role rather than a wrapping <label>, so each button keeps its own
 * accessible name instead of inheriting the whole group's text. */
export function FieldGroup({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3.5" role="group" aria-label={label}>
      <div className="mb-1.5 text-[13px] text-muted">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-accent";

const BADGE_TONES = {
  neutral: "bg-surface text-muted",
  good: "bg-accent-soft text-accent",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function resultTone(
  result: string,
): "good" | "bad" | "warn" | "neutral" {
  if (result === "improved") return "good";
  if (result === "worsened") return "bad";
  if (result === "inconclusive") return "warn";
  return "neutral";
}

export function confidenceTone(c: string): "good" | "warn" | "bad" {
  return c === "high" ? "good" : c === "medium" ? "warn" : "bad";
}
