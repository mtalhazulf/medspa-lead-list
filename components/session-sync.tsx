"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the Supabase session alive from the browser.
 *
 * Next 16's `proxy.ts` only runs on the Node.js runtime, which the Cloudflare
 * adapter cannot deploy, so there is no middleware to refresh the auth cookie
 * on the server. The browser client refreshes the access token on its own and
 * writes the updated cookie, which is what server requests read.
 *
 * Authorization never depended on this: every page, Server Action and Route
 * Handler calls `requireUser()`, and RLS is the backstop.
 */
export function SessionSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Reading the session triggers a refresh when the token is close to expiry.
    void supabase.auth.getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
      else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
