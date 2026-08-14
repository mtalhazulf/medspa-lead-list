import Link from "next/link";

export default function LeadNotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="text-base font-semibold text-slate-900">Lead not found</h2>
      <p className="mt-2 text-sm text-slate-500">
        It may have been removed, or the link is out of date.
      </p>
      <Link href="/leads" className="btn-primary mt-4">
        Back to leads
      </Link>
    </div>
  );
}
