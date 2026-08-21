import type { Route } from "next";
import Link from "next/link";

export function LeadTabs({
  leadId,
  current,
}: {
  leadId: string;
  current: "profile" | "history";
}) {
  const tabs = [
    { id: "profile" as const, label: "Profile", href: `/leads/${leadId}` },
    { id: "history" as const, label: "History", href: `/leads/${leadId}?tab=history` },
  ];

  return (
    <nav className="flex gap-1 border-b border-slate-200" aria-label="Client sections">
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href as Route}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
