"use client";

/** Non-medical positioning. Shown in the builder and on reports so the
 * product never reads as diagnosis or treatment. */
export function SafetyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mb-4 rounded-lg border border-line bg-surface text-muted ${
        compact ? "px-3 py-2 text-xs" : "px-3.5 py-3 text-[13px]"
      }`}
    >
      This is a personal learning tool, not medical advice. It does not
      diagnose, treat, or manage any medical condition. Avoid extreme
      restriction, and talk to a qualified clinician about medical or
      nutrition questions — especially around illness, disordered eating, or
      chronic conditions.
    </div>
  );
}
