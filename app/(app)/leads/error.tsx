"use client";

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="text-base font-semibold text-slate-900">Could not load leads</h2>
      <p className="mt-2 text-sm text-slate-500">
        {error.message || "Something went wrong talking to Supabase."}
      </p>
      {error.digest && <p className="mt-1 text-xs text-slate-400">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
