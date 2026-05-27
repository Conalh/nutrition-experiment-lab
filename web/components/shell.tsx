"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/nav/nav-rail";

/** App chrome: a left nav rail + scrollable main. The /login route renders
 * full-screen with no rail. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Login and the printable report render full-screen without the rail.
  if (pathname === "/login" || pathname.startsWith("/reports/"))
    return <>{children}</>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
      <NavRail />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
