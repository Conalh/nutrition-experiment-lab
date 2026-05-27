"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Beaker, NotebookPen, Plus, Settings2, LogOut } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LabMark } from "@/components/brand/lab-mark";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const items: NavItem[] = [
  { id: "lab", label: "Lab", href: "/", icon: Beaker, exact: true },
  { id: "log", label: "Today's log", href: "/log", icon: NotebookPen },
  { id: "new", label: "New experiment", href: "/experiments/new", icon: Plus },
  { id: "account", label: "Account", href: "/account", icon: Settings2 },
];

/** Left nav rail. 60px wide, icon-only with hover labels — keeps the
 *  page chrome from competing with content. */
export function NavRail() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
  });

  const initials = me?.email?.slice(0, 2).toLowerCase() ?? "··";

  return (
    <aside className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-line bg-bg-sunken py-4">
      <Link
        href="/"
        className="mb-3 flex size-7 items-center justify-center rounded-sm border border-line-2 text-signal"
        aria-label="Nutrition Lab"
      >
        <LabMark size={16} />
      </Link>

      {items.map((it) => {
        const active = it.exact
          ? pathname === it.href
          : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.id}
            href={it.href}
            title={it.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-sm",
              active
                ? "bg-surface-2 text-ink"
                : "text-ink-3 hover:bg-surface-2 hover:text-ink-2",
            )}
          >
            <it.icon className="size-[15px]" />
            {active && (
              <span
                aria-hidden
                className="absolute -left-2 inset-y-2 w-0.5 rounded-sm bg-signal"
              />
            )}
          </Link>
        );
      })}

      <span className="flex-1" />

      <button
        onClick={() => logout.mutate()}
        title={me ? `Log out (${me.email})` : "Log out"}
        aria-label="Log out"
        className="flex size-9 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-2 hover:text-ink-2"
      >
        <LogOut className="size-[15px]" />
      </button>
      <div
        className="mt-1 flex size-7 items-center justify-center rounded-full border border-line-2 bg-surface-2 font-mono text-[11px] text-ink-3"
        aria-label="Account"
      >
        {initials}
      </div>
    </aside>
  );
}
