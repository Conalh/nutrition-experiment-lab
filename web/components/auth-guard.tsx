"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loading } from "./states";

/** Gates the app behind a session. Calls /api/auth/me; redirects to /login
 * when unauthenticated, and away from /login once signed in. The /login route
 * itself always renders so the user can get in. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;
    if (isError && !isLogin) router.replace("/login");
    if (data && isLogin) router.replace("/");
  }, [isLoading, isError, data, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl px-5 pt-6">
        <Loading label="Checking your session…" />
      </div>
    );
  if (isError) return null; // redirecting to /login
  return <>{children}</>;
}
