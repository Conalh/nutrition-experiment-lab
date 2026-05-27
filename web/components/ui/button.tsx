"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { ArrowRight } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ComponentType<{ className?: string }>;
  iconRight?: React.ComponentType<{ className?: string }>;
  full?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-[26px] px-[10px] text-[12px] gap-1.5",
  md: "h-8     px-[14px] text-[13px] gap-2",
  lg: "h-10    px-[18px] text-[14px] gap-2.5",
};

const iconSize: Record<Size, string> = {
  sm: "size-[12px]",
  md: "size-[13px]",
  lg: "size-[15px]",
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-signal text-on-signal border border-signal " +
    "hover:brightness-110",
  secondary:
    "bg-transparent text-ink border border-line-2 " +
    "hover:bg-surface-2 hover:border-line-3",
  ghost:
    "bg-transparent text-ink-2 border border-transparent " +
    "hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-transparent text-worsened border border-worsened-line " +
    "hover:bg-worsened-soft",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, full, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-medium tracking-[0.01em]",
        "transition-[background-color,border-color,color,filter] duration-(--duration-swift) ease-(--ease-instrument)",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        full && "w-full",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={iconSize[size]} />}
      <span>{children}</span>
      {IconRight && <IconRight className={iconSize[size]} />}
    </button>
  );
});

/** Convenience: a primary CTA with a trailing arrow. */
export function ContinueButton(props: Omit<ButtonProps, "variant" | "iconRight">) {
  return <Button variant="primary" iconRight={ArrowRight} {...props} />;
}
