import { cn } from "@/lib/cn";

interface TopBarProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Breadcrumb segments — the last one is shown as current. */
  breadcrumb?: string[];
  /** Status pill / badge that sits next to the title. */
  status?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function TopBar({ title, eyebrow, breadcrumb, status, actions, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-6 border-b border-line px-6 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {breadcrumb && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-(--tracking-label) text-ink-3"
          >
            {breadcrumb.map((segment, i) => (
              <span key={i} className={cn(i === breadcrumb.length - 1 ? "text-ink-2" : "text-ink-3")}>
                {i > 0 && <span className="mr-1.5 text-ink-4">/</span>}
                {segment}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="m-0 truncate font-display text-[28px] font-normal tracking-(--tracking-tight) text-ink">
            {title}
          </h1>
          {status}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
