import { cn } from "@/lib/cn";

interface LabMarkProps {
  size?: number;
  className?: string;
}

/** Beaker glyph. Used as the favicon, top-left brand mark, and the
 *  step icon in the zero-state hero. Pure SVG, currentColor. */
export function LabMark({ size = 24, className }: LabMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M9 3v6.5L4.8 18.5A1.5 1.5 0 0 0 6.1 21h11.8a1.5 1.5 0 0 0 1.3-2.5L15 9.5V3" />
      <path d="M8 3h8" />
      {/* meniscus */}
      <path d="M7.5 14.5c1.5-1 3-1 4.5 0s3 1 4.5 0" opacity="0.7" />
      {/* tick marks */}
      <path d="M6.5 17.5h1.5M7 19h1" opacity="0.4" />
    </svg>
  );
}
