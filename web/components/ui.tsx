"use client";

import React from "react";

const COLORS = {
  surface: "var(--surface)",
  card: "var(--card)",
  border: "var(--border)",
  text: "var(--text)",
  dim: "var(--text-dim)",
  accent: "var(--accent)",
  warn: "var(--warn)",
  bad: "var(--bad)",
};

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: COLORS.accent, color: "#0a0d10", fontWeight: 600 },
    ghost: {
      background: "transparent",
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: "transparent",
      color: COLORS.bad,
      border: `1px solid var(--bad)`,
    },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 14,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

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
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: COLORS.dim, marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-2)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: COLORS.text,
  fontSize: 14,
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--surface-2)", color: COLORS.dim },
    good: { background: "var(--accent-dim)", color: COLORS.accent },
    accent: { background: "var(--accent-dim)", color: COLORS.accent },
    warn: { background: "#3a2f10", color: COLORS.warn },
    bad: { background: "#3a1818", color: COLORS.bad },
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        ...tones[tone],
      }}
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
