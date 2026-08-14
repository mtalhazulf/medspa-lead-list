export default function LeadsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      <div className="card divide-y divide-slate-100">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
