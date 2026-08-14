import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Per-request memoized session lookup. Always verifies the JWT with Supabase
 * (`getUser`) rather than trusting the cookie payload.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? "";
  return {
    id: user.id,
    email,
    fullName: profile?.full_name ?? email.split("@")[0] ?? "Teammate",
  };
});

/** Use at the top of every authenticated page, layout and Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export const listTeammates = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? p.email ?? "Teammate",
  }));
});
