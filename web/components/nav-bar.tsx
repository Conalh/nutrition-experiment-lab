"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/log", label: "Daily Log" },
  { href: "/experiments/new", label: "New Experiment" },
  { href: "/account", label: "Account" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });

  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
  });

  if (pathname === "/login") return null;

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-5 px-5 py-3">
        <Link href="/" className="text-[15px] font-bold text-accent">
          Nutrition Lab
        </Link>
        <div className="ml-auto flex items-center gap-4">
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
          {me && (
            <button
              onClick={() => logout.mutate()}
              className="text-sm text-muted hover:text-ink"
              title={`Signed in as ${me.email}`}
            >
              Log out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
