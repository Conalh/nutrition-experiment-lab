import { cn } from "@/lib/cn";

interface KVProps {
  rows: Array<[label: React.ReactNode, value: React.ReactNode, opts?: { mono?: boolean }]>;
  columns?: 1 | 2;
  className?: string;
}

/** Definition-list-style key/value pairs. Used in the summary panels
 *  on the builder + detail screens. */
export function KV({ rows, columns = 1, className }: KVProps) {
  return (
    <dl
      className={cn("m-0 grid gap-x-8", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {rows.map(([k, v, opts], i) => (
        <div
          key={i}
          className={cn(
            "flex items-baseline justify-between gap-4 py-2",
            i < rows.length - columns && "border-b border-line",
          )}
        >
          <dt className="text-[12px] uppercase tracking-(--tracking-label) text-ink-3">{k}</dt>
          <dd
            className={cn(
              "m-0 text-right text-[13px] text-ink",
              opts?.mono && "font-mono tabular-nums",
            )}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
