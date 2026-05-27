import * as React from "react";
import { cn } from "@/lib/cn";

interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Decorative crosshair brackets in each corner. */
  corners?: boolean;
  /** Glow ring in signal color — used for "active" hero cards. */
  glow?: boolean;
  /** Internal padding step. Default 20. */
  padding?: 16 | 20 | 24 | 32;
}

const paddingClass = {
  16: "p-4",
  20: "p-5",
  24: "p-6",
  32: "p-8",
} as const;

const headerPadClass = {
  16: "px-4 py-3",
  20: "px-5 py-[14px]",
  24: "px-6 py-4",
  32: "px-8 py-5",
} as const;

/** Surface with hairline. Header is auto-rendered when any of
 *  eyebrow/title/actions is supplied. */
export function Card({
  eyebrow, title, actions, footer, corners, glow,
  padding = 20, className, children, ...rest
}: CardProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-sm border border-line bg-surface shadow-(--shadow-1)",
        glow && "shadow-(--shadow-glow-signal)",
        className,
      )}
      {...rest}
    >
      {corners && (
        <>
          <span aria-hidden className="nl-corner nl-corner-tl" />
          <span aria-hidden className="nl-corner nl-corner-tr" />
          <span aria-hidden className="nl-corner nl-corner-bl" />
          <span aria-hidden className="nl-corner nl-corner-br" />
        </>
      )}

      {(eyebrow || title || actions) && (
        <header
          className={cn(
            "flex items-baseline justify-between gap-3 border-b border-line",
            headerPadClass[padding],
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && (
              <h3 className="m-0 font-display text-[22px] font-normal tracking-tight text-ink">
                {title}
              </h3>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}

      <div className={paddingClass[padding]}>{children}</div>

      {footer && (
        <footer className={cn("border-t border-line", headerPadClass[padding])}>{footer}</footer>
      )}
    </section>
  );
}
