"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

const INITIAL: AuthState = { ok: true, message: "" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <div className="card p-6">
      <form action={formAction} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="label mb-1" htmlFor="fullName">
              Name
            </label>
            <input id="fullName" name="fullName" className="input" autoComplete="name" required />
          </div>
        )}

        <div>
          <label className="label mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="label mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </div>

        {state.message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
            }`}
            role="status"
          >
            {state.message}
          </p>
        )}

        <SubmitButton label={mode === "signin" ? "Sign in" : "Create account"} />
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-slate-900 underline underline-offset-2"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
