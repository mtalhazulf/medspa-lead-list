import type { Route } from "next";
import Link from "next/link";

import {
  buildLeadQueryString,
  defaultDirection,
  type LeadQuery,
  type SortKey,
} from "@/lib/leads/query";

export function SortHeader({
  field,
  query,
  children,
  align = "left",
}: {
  field: SortKey;
  query: LeadQuery;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const active = query.sort === field;
  const nextDir: "asc" | "desc" = active
    ? query.dir === "asc"
      ? "desc"
      : "asc"
    : defaultDirection(field);
  const href = `/leads${buildLeadQueryString({ sort: field, dir: nextDir, page: 1 }, query)}` as Route;
  const arrow = !active ? "↕" : query.dir === "asc" ? "↑" : "↓";

  return (
    <th className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:text-slate-900 ${
          active ? "text-slate-900" : "text-slate-500"
        } ${align === "right" ? "justify-end" : ""}`}
        aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        <span className={`text-[10px] ${active ? "text-slate-700" : "text-slate-300"}`} aria-hidden>
          {arrow}
        </span>
      </Link>
    </th>
  );
}
