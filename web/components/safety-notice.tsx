"use client";

/** Non-medical positioning. Shown in the builder and on reports so the
 * product never reads as diagnosis or treatment. */
export function SafetyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        borderRadius: 10,
        padding: compact ? "8px 12px" : "12px 14px",
        fontSize: compact ? 12 : 13,
        color: "var(--text-dim)",
        marginBottom: 16,
      }}
    >
      This is a personal learning tool, not medical advice. It does not
      diagnose, treat, or manage any medical condition. Avoid extreme
      restriction, and talk to a qualified clinician about medical or
      nutrition questions — especially around illness, disordered eating, or
      chronic conditions.
    </div>
  );
}
