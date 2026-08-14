import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getSessionUser } from "@/lib/dal/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // No middleware to bounce signed-in visitors, so check here.
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Med Spa Lead Desk</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to work the pipeline.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
