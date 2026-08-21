import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/leads/types";
import { activityMeta } from "@/lib/pipeline";
import type { Route } from "next";
import Link from "next/link";

export function ActivityTimeline({
  items,
  showClient = false,
}: {
  items: ActivityItem[];
  showClient?: boolean;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">Nothing logged yet.</p>;
  }

  return (
    <ol className="mt-4 space-y-4">
      {items.map((item) => {
        const meta = activityMeta(item.type);
        return (
          <li key={item.id} className="flex gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs"
              aria-hidden
            >
              {meta.icon}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-slate-900">
                  {item.user?.full_name ?? item.user?.email ?? "System"}
                </span>
                <span className="text-slate-500">{meta.label.toLowerCase()}</span>
                {item.contact && (
                  <span className="text-slate-600">
                    with {item.contact.full_name}
                  </span>
                )}
                {showClient && item.lead && (
                  <Link
                    href={`/leads/${item.lead.id}?tab=history` as Route}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    {item.lead.company_name}
                  </Link>
                )}
                <span className="text-xs text-slate-400">{formatDateTime(item.occurred_at)}</span>
              </div>

              {item.type === "status_change" && item.to_status && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {item.from_status && <StatusPill status={item.from_status} />}
                  <span className="text-slate-400">→</span>
                  <StatusPill status={item.to_status} />
                </div>
              )}

              {item.body && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
