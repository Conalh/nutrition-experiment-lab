"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/log", label: "Daily Log" },
  { href: "/experiments/new", label: "New Experiment" },
  { href: "/account", label: "Account" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-5 px-5 py-3">
        <Link href="/" className="text-[15px] font-bold text-accent">
          Nutrition Lab
        </Link>
        <div className="ml-auto flex gap-4">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${
                  active ? "font-semibold text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
