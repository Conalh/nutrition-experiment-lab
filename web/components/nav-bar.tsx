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
    <nav
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Link
          href="/"
          style={{ fontWeight: 700, color: "var(--accent)", fontSize: 15 }}
        >
          Nutrition Lab
        </Link>
        <div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  fontSize: 14,
                  color: active ? "var(--text)" : "var(--text-dim)",
                  fontWeight: active ? 600 : 400,
                }}
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
