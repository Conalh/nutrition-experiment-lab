import { LabMark } from "./lab-mark";
import { cn } from "@/lib/cn";

interface WordmarkProps {
  size?: number;
  className?: string;
}

/** Brand wordmark — italic Instrument Serif paired with the LabMark
 *  in signal amber. Used on login, report masthead. */
export function Wordmark({ size = 18, className }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LabMark size={size + 4} className="text-signal" />
      <span
        className="font-display italic tracking-tight leading-none"
        style={{ fontSize: size }}
      >
        Nutrition Lab
      </span>
    </span>
  );
}
